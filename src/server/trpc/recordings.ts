import { z } from "zod";
import { router, publicProcedure } from "./init";
import { analyzeCall } from "@/server/services/call-analyzer";

export const recordingsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          clientId: z.string().optional(),
          sessionId: z.string().optional(),
          type: z.enum(["CALL", "MEETING"]).optional(),
          analyzed: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input?.clientId) where.clientId = input.clientId;
      if (input?.sessionId) where.sessionId = input.sessionId;
      if (input?.type) where.type = input.type;
      if (input?.analyzed === true) where.aiScore = { not: null };
      if (input?.analyzed === false) where.aiScore = null;

      return ctx.prisma.recording.findMany({
        where,
        include: { client: true, session: true },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.recording.findUniqueOrThrow({
      where: { id: input },
      include: { client: true, session: true },
    });
  }),

  // Upload a call recording (metadata - file goes to R2 separately)
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        type: z.enum(["CALL", "MEETING"]).default("CALL"),
        duration: z.number().optional(),
        fileUrl: z.string(),
        fileSize: z.number().optional(),
        transcript: z.string().optional(),
        clientId: z.string(),
        sessionId: z.string().optional(),
        scriptName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const recording = await ctx.prisma.recording.create({
        data: input,
      });

      // Auto-analyze if transcript is provided
      if (input.transcript) {
        analyzeCall(recording.id).catch((err) =>
          console.error("Auto call analysis failed:", err)
        );
      }

      return recording;
    }),

  // Add transcript to an existing recording (and auto-analyze)
  addTranscript: publicProcedure
    .input(
      z.object({
        id: z.string(),
        transcript: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const recording = await ctx.prisma.recording.update({
        where: { id: input.id },
        data: { transcript: input.transcript },
      });

      // Auto-analyze
      analyzeCall(recording.id).catch((err) =>
        console.error("Auto call analysis failed:", err)
      );

      return recording;
    }),

  // Manually trigger analysis
  analyze: publicProcedure
    .input(z.string()) // recordingId
    .mutation(async ({ input }) => {
      return analyzeCall(input);
    }),
});
