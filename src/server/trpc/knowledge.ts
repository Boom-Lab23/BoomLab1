import { z } from "zod";
import { router, publicProcedure } from "./init";
import { detectDocumentMarkets } from "../services/sales-call-analyzer";
import { extractGoogleFileId, fetchDriveFileContent } from "../services/google-docs";

export const knowledgeRouter = router({
  // List all knowledge base documents (optionally filtered by market)
  list: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      market: z.enum(["ALL", "CREDITO", "SEGUROS", "IMOBILIARIO"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (input?.category) where.category = input.category;
      if (input?.market && input.market !== "ALL") {
        where.OR = [
          { markets: { has: "ALL" } },
          { markets: { has: input.market } },
        ];
      }

      return ctx.prisma.aIScript.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    }),

  // Add a document to the knowledge base (now supports file upload + google doc)
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      category: z.string(),  // scripts-vendas, frameworks-reuniao, criterios, materiais, esquemas-sops
      pillar: z.string().default("geral"),
      content: z.string().default(""),
      criteria: z.record(z.unknown()).optional(),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      fileType: z.string().optional(),
      googleDocUrl: z.string().url().optional().or(z.literal("")),
    }))
    .mutation(async ({ ctx, input }) => {
      let finalContent = input.content || "";

      // Se foi dado googleDocUrl, tenta fazer fetch automatico do conteudo (live)
      // Usa o user que esta autenticado (ctx.session.user.id) para o token OAuth.
      if (input.googleDocUrl) {
        const fileId = extractGoogleFileId(input.googleDocUrl);
        const userId = (ctx.session?.user as Record<string, unknown> | undefined)?.id as string | undefined;
        if (fileId && userId) {
          try {
            const fetched = await fetchDriveFileContent(userId, fileId);
            if (fetched.text) finalContent = fetched.text;
          } catch (err) {
            console.error("[knowledge.create] google doc fetch failed:", err);
          }
        }
      }

      if (!finalContent) {
        finalContent = input.googleDocUrl
          ? `[Google Doc: ${input.googleDocUrl}]`
          : input.fileName
          ? `[Ficheiro: ${input.fileName}]`
          : "";
      }

      // Auto-detect which markets this doc applies to (runs Claude)
      let markets: string[] = ["ALL"];
      try {
        markets = await detectDocumentMarkets({
          name: input.name,
          category: input.category,
          content: finalContent,
        });
      } catch (err) {
        console.error("[knowledge.create] market detection failed, defaulting to ALL:", err);
      }

      return ctx.prisma.aIScript.create({
        data: {
          name: input.name,
          category: input.category,
          pillar: input.pillar,
          content: finalContent,
          criteria: input.criteria ?? {},
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          fileType: input.fileType,
          googleDocUrl: input.googleDocUrl || null,
          markets,
        },
      });
    }),

  // Re-fetch o conteudo do googleDocUrl associado e actualiza content + markets.
  syncFromGoogleDoc: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.aIScript.findUniqueOrThrow({ where: { id: input.id } });
      if (!doc.googleDocUrl) {
        throw new Error("Este documento nao tem Google Doc URL associado.");
      }
      const fileId = extractGoogleFileId(doc.googleDocUrl);
      if (!fileId) throw new Error("URL do Google Doc invalido (nao foi possivel extrair o ID).");

      const userId = (ctx.session?.user as Record<string, unknown> | undefined)?.id as string | undefined;
      if (!userId) throw new Error("Sessao invalida.");

      const fetched = await fetchDriveFileContent(userId, fileId);
      if (!fetched.text) {
        throw new Error(`Tipo de ficheiro nao suportado para sync automatico: ${fetched.mimeType}. Suportado apenas Google Docs/Sheets/Slides.`);
      }

      // Re-detect markets com o conteudo novo
      let markets = doc.markets;
      try {
        markets = await detectDocumentMarkets({
          name: doc.name,
          category: doc.category,
          content: fetched.text,
        });
      } catch (err) {
        console.error("[knowledge.syncFromGoogleDoc] market detection failed:", err);
      }

      return ctx.prisma.aIScript.update({
        where: { id: input.id },
        data: {
          content: fetched.text,
          markets,
        },
      });
    }),

  // Sincroniza TODOS os AIScripts que tem googleDocUrl. Para cron diario.
  syncAllFromGoogleDocs: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const docs = await ctx.prisma.aIScript.findMany({
        where: { isActive: true, googleDocUrl: { not: null } },
      });
      let synced = 0, failed = 0;
      const errors: Array<{ id: string; name: string; error: string }> = [];
      for (const d of docs) {
        const fileId = d.googleDocUrl ? extractGoogleFileId(d.googleDocUrl) : null;
        if (!fileId) { failed++; errors.push({ id: d.id, name: d.name, error: "URL invalido" }); continue; }
        try {
          const fetched = await fetchDriveFileContent(input.userId, fileId);
          if (fetched.text) {
            await ctx.prisma.aIScript.update({
              where: { id: d.id },
              data: { content: fetched.text },
            });
            synced++;
          } else {
            failed++;
            errors.push({ id: d.id, name: d.name, error: `MIME nao suportado: ${fetched.mimeType}` });
          }
        } catch (err) {
          failed++;
          errors.push({ id: d.id, name: d.name, error: err instanceof Error ? err.message : String(err) });
        }
      }
      return { synced, failed, total: docs.length, errors };
    }),

  // Re-run AI market detection for an existing doc
  redetectMarkets: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.aIScript.findUniqueOrThrow({ where: { id: input.id } });
      const markets = await detectDocumentMarkets({
        name: doc.name,
        category: doc.category,
        content: doc.content,
      });
      return ctx.prisma.aIScript.update({ where: { id: doc.id }, data: { markets } });
    }),

  // Manually override markets
  setMarkets: publicProcedure
    .input(z.object({
      id: z.string(),
      markets: z.array(z.enum(["ALL", "CREDITO", "SEGUROS", "IMOBILIARIO"])).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // If ALL is present, force [ALL] only
      const clean = input.markets.includes("ALL") ? ["ALL"] : input.markets;
      return ctx.prisma.aIScript.update({ where: { id: input.id }, data: { markets: clean } });
    }),

  // Update a document
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      isActive: z.boolean().optional(),
      googleDocUrl: z.string().url().optional().or(z.literal("")),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      fileType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const data: Record<string, unknown> = { ...rest };
      if (data.googleDocUrl === "") data.googleDocUrl = null;

      // Se googleDocUrl mudou para um valor novo, busca o conteudo live agora
      if (input.googleDocUrl) {
        const existing = await ctx.prisma.aIScript.findUnique({ where: { id } });
        const urlChanged = existing?.googleDocUrl !== input.googleDocUrl;
        const userId = (ctx.session?.user as Record<string, unknown> | undefined)?.id as string | undefined;
        if (urlChanged && userId) {
          const fileId = extractGoogleFileId(input.googleDocUrl);
          if (fileId) {
            try {
              const fetched = await fetchDriveFileContent(userId, fileId);
              if (fetched.text) data.content = fetched.text;
            } catch (err) {
              console.error("[knowledge.update] google doc fetch failed:", err);
            }
          }
        }
      }

      return ctx.prisma.aIScript.update({ where: { id }, data });
    }),

  // Delete a document
  delete: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.aIScript.update({
        where: { id: input },
        data: { isActive: false },
      });
    }),

  // Get category counts
  categoryCounts: publicProcedure.query(async ({ ctx }) => {
    const docs = await ctx.prisma.aIScript.findMany({
      where: { isActive: true },
      select: { category: true },
    });

    const counts: Record<string, number> = {};
    for (const doc of docs) {
      const cat = doc.category ?? "outros";
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    return counts;
  }),

  // Update sales profile for a user (personality, style, etc.)
  updateSalesProfile: publicProcedure
    .input(z.object({
      userId: z.string(),
      profile: z.object({
        personality: z.string(),
        strengths: z.string(),
        weaknesses: z.string(),
        communicationStyle: z.string(),
        goals: z.string(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { salesProfile: input.profile },
      });
    }),

  // Get user's weekly call submission status
  weeklyCallStatus: publicProcedure
    .input(z.string()) // userId
    .query(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: input } });
      const now = new Date();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const submissions = await ctx.prisma.callSubmission.count({
        where: {
          userId: input,
          weekStart: { gte: monday, lte: sunday },
        },
      });

      return {
        submitted: submissions,
        target: user?.weeklyCallTarget ?? 5,
        weekStart: monday,
        weekEnd: sunday,
        daysLeft: 7 - ((now.getDay() + 6) % 7),
      };
    }),
});
