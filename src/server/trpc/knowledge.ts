import { z } from "zod";
import { router, publicProcedure } from "./init";

export const knowledgeRouter = router({
  // List all knowledge base documents
  list: publicProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isActive: true };
      if (input?.category) where.category = input.category;

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
      return ctx.prisma.aIScript.create({
        data: {
          name: input.name,
          category: input.category,
          pillar: input.pillar,
          content: input.content || (input.googleDocUrl ? `[Google Doc: ${input.googleDocUrl}]` : input.fileName ? `[Ficheiro: ${input.fileName}]` : ""),
          criteria: input.criteria ?? {},
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          fileType: input.fileType,
          googleDocUrl: input.googleDocUrl || null,
        },
      });
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
