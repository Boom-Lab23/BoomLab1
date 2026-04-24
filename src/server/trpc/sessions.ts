import { z } from "zod";
import { router, publicProcedure } from "./init";
import { generateActionPlanDraft } from "../services/action-plan-workflow";

export const sessionsRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          clientId: z.string().optional(),
          status: z.string().optional(),
          module: z.string().optional(),
          from: z.date().optional(),
          to: z.date().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input?.clientId) where.clientId = input.clientId;
      if (input?.status) where.status = input.status;
      if (input?.module) where.module = { contains: input.module, mode: "insensitive" };
      if (input?.from || input?.to) {
        where.date = {};
        if (input.from) (where.date as Record<string, unknown>).gte = input.from;
        if (input.to) (where.date as Record<string, unknown>).lte = input.to;
      }

      return ctx.prisma.session.findMany({
        where,
        include: {
          client: true,
          assignedTo: true,
          _count: { select: { recordings: true, documents: true } },
        },
        orderBy: { date: "desc" },
      });
    }),

  getById: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    // findUnique (nao throw) para evitar crash se id nao existir
    const session = await ctx.prisma.session.findUnique({
      where: { id: input },
      include: {
        client: true,
        assignedTo: true,
        recordings: true,
        documents: true,
      },
    });
    return session;
  }),

  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        module: z.string().min(1),
        topic: z.string().optional(),
        date: z.date().optional(),
        status: z.string().default("POR_AGENDAR"),
        clientId: z.string(),
        assignedToId: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.session.create({
        data: input as Record<string, unknown>,
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          title: z.string().optional(),
          module: z.string().optional(),
          topic: z.string().nullable().optional(),
          date: z.date().nullable().optional(),
          status: z.string().optional(),
          evaluation: z.number().nullable().optional(),
          notes: z.string().nullable().optional(),
          assignedToId: z.string().nullable().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.session.update({
        where: { id: input.id },
        data: input.data as Record<string, unknown>,
      });
    }),

  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.session.delete({ where: { id: input } });
  }),

  upcoming: publicProcedure
    .input(z.object({
      assignedToUserId: z.string().optional(),
      clientId: z.string().optional(),
      excludeModules: z.array(z.string()).optional(),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const statusFilter: Record<string, unknown> = {
        OR: [
          { date: { gte: startOfToday }, status: { in: ["MARCADA", "AGUARDAR_CONFIRMACAO", "POR_AGENDAR", "REAGENDADA"] } },
          { date: null, status: { in: ["POR_AGENDAR", "AGUARDAR_CONFIRMACAO"] } },
        ],
      };

      const baseWhere: Record<string, unknown> = { ...statusFilter };
      if (input?.clientId) baseWhere.clientId = input.clientId;
      if (input?.excludeModules && input.excludeModules.length > 0) {
        baseWhere.module = { notIn: input.excludeModules };
      }

      // Filter by member: includes sessions directly assigned OR sessions of clients
      // whose past sessions have been led by that consultant (EOM/off-boarding have
      // null assignedToId, so infer via client history).
      if (input?.assignedToUserId) {
        const memberId = input.assignedToUserId;
        const clientIdsViaHistory = await ctx.prisma.session.findMany({
          where: { assignedToId: memberId, status: "CONCLUIDA" },
          select: { clientId: true },
          distinct: ["clientId"],
        });
        const clientIds = clientIdsViaHistory.map((c) => c.clientId);
        baseWhere.OR = [
          { assignedToId: memberId, ...statusFilter },
          clientIds.length > 0
            ? { clientId: { in: clientIds }, assignedToId: null, ...statusFilter }
            : { id: "__never__" },
        ];
        delete (baseWhere as Record<string, unknown>).clientId;
        // Re-apply clientId scoping if explicitly provided
        if (input.clientId) {
          baseWhere.OR = (baseWhere.OR as Record<string, unknown>[]).map((o) => ({ ...o, clientId: input.clientId }));
        }
      }

      return ctx.prisma.session.findMany({
        where: baseWhere,
        include: { client: true, assignedTo: true },
        orderBy: [{ date: "asc" }, { createdAt: "desc" }],
        take: input?.limit ?? 20,
      });
    }),

  // Generate action plan (manual trigger) - calls Claude with transcript + KB
  generateActionPlan: publicProcedure
    .input(z.string()) // sessionId
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.prisma.session.findUnique({ where: { id: input } });
      if (!session) throw new Error("Sessao nao encontrada.");
      if (!session.firefliesNotes) {
        throw new Error("Esta sessao nao tem transcricao do Fireflies. Faz sync primeiro.");
      }
      const draftId = await generateActionPlanDraft(input);
      const updated = await ctx.prisma.session.findUnique({ where: { id: input } });
      return { draftId, actionPlan: updated?.actionPlan };
    }),

  // Get action plan drafts for a session
  actionPlanDrafts: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.actionPlanDraft.findMany({
      where: { sessionId: input },
      orderBy: { createdAt: "desc" },
    });
  }),
});
