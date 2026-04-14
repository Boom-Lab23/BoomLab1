import { z } from "zod";
import { router, publicProcedure } from "./init";

export const clientsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          offer: z.string().optional(),
          risk: z.string().optional(),
          search: z.string().optional(),
          salesConsulting: z.boolean().optional(),
          dashboardReview: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input?.status) where.status = input.status;
      if (input?.risk) where.risk = input.risk;
      if (input?.offer) where.offer = { has: input.offer };
      if (input?.salesConsulting) where.salesConsulting = true;
      if (input?.dashboardReview) where.dashboardReview = true;
      if (input?.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { ceo: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ];
      }

      return ctx.prisma.client.findMany({
        where,
        include: {
          sessions: { orderBy: { date: "desc" }, take: 5 },
          _count: { select: { sessions: true, recordings: true, documents: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  getById: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.client.findUniqueOrThrow({
      where: { id: input },
      include: {
        sessions: {
          include: { assignedTo: true, recordings: true },
          orderBy: { date: "desc" },
        },
        recordings: { orderBy: { createdAt: "desc" } },
        documents: { orderBy: { updatedAt: "desc" } },
      },
    });
  }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        ceo: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        coreBusiness: z.string().optional(),
        composition: z.string().optional(),
        painPoints: z.string().optional(),
        projectDuration: z.string().optional(),
        projectStart: z.date().optional(),
        projectEnd: z.date().optional(),
        status: z.string().default("PRE_ARRANQUE"),
        offer: z.array(z.string()).default([]),
        risk: z.string().optional(),
        ticket: z.number().optional(),
        billing: z.number().optional(),
        expectations: z.string().optional(),
        salesConsulting: z.boolean().default(false),
        dashboardReview: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.client.create({
        data: input as Record<string, unknown>,
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          ceo: z.string().nullable().optional(),
          email: z.string().nullable().optional(),
          phone: z.string().nullable().optional(),
          coreBusiness: z.string().nullable().optional(),
          composition: z.string().nullable().optional(),
          painPoints: z.string().nullable().optional(),
          projectDuration: z.string().nullable().optional(),
          projectStart: z.date().nullable().optional(),
          projectEnd: z.date().nullable().optional(),
          status: z.string().optional(),
          offer: z.array(z.string()).optional(),
          risk: z.string().nullable().optional(),
          csat: z.number().nullable().optional(),
          ticket: z.number().nullable().optional(),
          billing: z.number().nullable().optional(),
          expectations: z.string().nullable().optional(),
          otherInfo: z.string().nullable().optional(),
          salesConsulting: z.boolean().optional(),
          dashboardReview: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.client.update({
        where: { id: input.id },
        data: input.data as Record<string, unknown>,
      });
    }),

  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.client.delete({ where: { id: input } });
  }),

  stats: publicProcedure.query(async ({ ctx }) => {
    const [total, active, boomClub, avgCsat] = await Promise.all([
      ctx.prisma.client.count(),
      ctx.prisma.client.count({ where: { status: "ATIVO" } }),
      ctx.prisma.client.count({ where: { offer: { has: "BoomClub" } } }),
      ctx.prisma.client.aggregate({ _avg: { csat: true }, where: { csat: { not: null } } }),
    ]);
    return { total, active, boomClub, avgCsat: avgCsat._avg.csat };
  }),
});
