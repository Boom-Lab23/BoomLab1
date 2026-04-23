import { z } from "zod";
import { router, publicProcedure } from "./init";

export const ghlRouter = router({
  // Listar eventos recebidos (paginado simples)
  events: publicProcedure
    .input(z.object({
      status: z.enum(["processed", "skipped", "failed", "pending"]).optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.ghlEvent.findMany({
        where: input?.status ? { status: input.status } : undefined,
        orderBy: { createdAt: "desc" },
        take: input?.limit ?? 50,
      });
    }),

  // Reprocessar um evento (ex: depois de arranjar o mapping)
  reprocess: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.prisma.ghlEvent.findUniqueOrThrow({
        where: { id: input.eventId },
      });
      const { processGhlWebhook } = await import("../services/ghl-intake");
      return processGhlWebhook(event.payload as Parameters<typeof processGhlWebhook>[0]);
    }),

  // Pipeline mappings
  listMappings: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.ghlPipelineMapping.findMany({
      orderBy: { createdAt: "asc" },
    });
  }),

  upsertMapping: publicProcedure
    .input(z.object({
      ghlPipelineId: z.string(),
      ghlPipelineName: z.string(),
      offer: z.string(),
      defaultPillars: z.array(z.string()).default([]),
      isActive: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.ghlPipelineMapping.upsert({
        where: { ghlPipelineId: input.ghlPipelineId },
        create: input,
        update: {
          ghlPipelineName: input.ghlPipelineName,
          offer: input.offer,
          defaultPillars: input.defaultPillars,
          isActive: input.isActive,
        },
      });
    }),

  deleteMapping: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.ghlPipelineMapping.delete({ where: { id: input.id } });
    }),

  // Fetch pipelines do GHL via API (requer GHL_API_KEY + GHL_LOCATION_ID em env)
  fetchPipelinesFromGhl: publicProcedure.mutation(async () => {
    const apiKey = process.env.GHL_API_KEY;
    const locationId = process.env.GHL_LOCATION_ID;
    if (!apiKey || !locationId) {
      throw new Error("GHL_API_KEY e GHL_LOCATION_ID nao configurados no .env.production");
    }
    const url = `https://services.leadconnectorhq.com/opportunities/pipelines?locationId=${locationId}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: "2021-07-28",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GHL API ${res.status}: ${text}`);
    }
    const data = await res.json() as { pipelines?: Array<{ id: string; name: string; stages?: Array<{ id: string; name: string }> }> };
    return data.pipelines ?? [];
  }),
});
