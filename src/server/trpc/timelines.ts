import { z } from "zod";
import { router, publicProcedure } from "./init";

export const timelinesRouter = router({
  // List timelines (optionally by client)
  list: publicProcedure
    .input(z.object({ clientId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.timeline.findMany({
        where: input?.clientId ? { clientId: input.clientId } : {},
        include: {
          client: true,
          phases: {
            include: {
              modules: {
                include: { sessions: { orderBy: { order: "asc" } } },
                orderBy: { order: "asc" },
              },
            },
            orderBy: { order: "asc" },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  // Get a single timeline
  getById: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.timeline.findUniqueOrThrow({
      where: { id: input },
      include: {
        client: true,
        phases: {
          include: {
            modules: {
              include: { sessions: { orderBy: { order: "asc" } } },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });
  }),

  // Create a timeline
  create: publicProcedure
    .input(z.object({
      clientId: z.string(),
      title: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.timeline.create({ data: input });
    }),

  // Add a phase to a timeline
  addPhase: publicProcedure
    .input(z.object({
      timelineId: z.string(),
      number: z.number(),
      title: z.string(),
      startDate: z.date().optional(),
      endDate: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { timelineId, ...data } = input;
      return ctx.prisma.timelinePhase.create({
        data: { ...data, timelineId, order: input.number },
      });
    }),

  // Add a module to a phase
  addModule: publicProcedure
    .input(z.object({
      phaseId: z.string(),
      title: z.string(),
      consultantName: z.string().optional(),
      consultantRole: z.string().optional(),
      order: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const { phaseId, ...data } = input;
      return ctx.prisma.timelineModule.create({
        data: { ...data, phaseId },
      });
    }),

  // Add a session to a module
  addSession: publicProcedure
    .input(z.object({
      moduleId: z.string(),
      number: z.number(),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      topics: z.array(z.string()).default([]),
      order: z.number().default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const { moduleId, ...data } = input;
      return ctx.prisma.timelineSession.create({
        data: { ...data, moduleId },
      });
    }),

  // Update a phase
  updatePhase: publicProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      startDate: z.date().nullable().optional(),
      endDate: z.date().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.timelinePhase.update({ where: { id }, data: data as Record<string, unknown> });
    }),

  // Update a session
  updateSession: publicProcedure
    .input(z.object({
      id: z.string(),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      topics: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.timelineSession.update({ where: { id }, data });
    }),

  // Delete timeline
  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.timeline.delete({ where: { id: input } });
  }),

  // Delete phase
  deletePhase: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.timelinePhase.delete({ where: { id: input } });
  }),
});
