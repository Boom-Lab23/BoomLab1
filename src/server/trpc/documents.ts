import { z } from "zod";
import { router, publicProcedure } from "./init";
import {
  listGoogleDocs,
  linkGoogleDoc,
  syncLinkedDocs,
} from "@/server/services/google-docs";

export const documentsRouter = router({
  // List documents in the platform
  list: publicProcedure
    .input(
      z
        .object({
          pillar: z.string().optional(),
          clientId: z.string().optional(),
          sessionId: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input?.pillar) where.pillar = input.pillar;
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.sessionId) where.sessionId = input.sessionId;

      return ctx.prisma.document.findMany({
        where,
        include: { client: true, session: true },
        orderBy: { updatedAt: "desc" },
      });
    }),

  // Search Google Docs from Drive
  searchGoogleDocs: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        query: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      return listGoogleDocs(input.userId, input.query);
    }),

  // Link a Google Doc to the platform
  linkGoogleDoc: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        documentId: z.string(),
        pillar: z.string(),
        clientId: z.string().optional(),
        sessionId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await linkGoogleDoc(
        input.userId,
        input.documentId,
        input.pillar,
        input.clientId,
        input.sessionId
      );
      return { success: true };
    }),

  // Sync all linked docs
  sync: publicProcedure
    .input(z.string()) // userId
    .mutation(async ({ input }) => {
      return syncLinkedDocs(input);
    }),

  // Create a document manually
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        pillar: z.string(),
        googleDocsUrl: z.string().optional(),
        clientId: z.string().optional(),
        sessionId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Extract Google Docs ID from URL if provided
      let googleDocsId: string | undefined;
      if (input.googleDocsUrl) {
        const match = input.googleDocsUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match) googleDocsId = match[1];
      }

      return ctx.prisma.document.create({
        data: {
          title: input.title,
          pillar: input.pillar,
          googleDocsId,
          googleDocsUrl: input.googleDocsUrl,
          clientId: input.clientId,
          sessionId: input.sessionId,
        },
      });
    }),

  // Delete a document
  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.document.delete({ where: { id: input } });
  }),
});
