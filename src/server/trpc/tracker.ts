import { z } from "zod";
import { router, publicProcedure } from "./init";

/**
 * Accountability Tracker
 * Gestor pessoal de tarefas diarias (tipo mini-CRM / to-do estruturado).
 * Cada tarefa tem categoria, prioridade, status, deadline. Pertence a um user.
 */

const CATEGORIES = ["PROSPECAO", "FOLLOW_UP", "REUNIAO", "ADMIN", "OUTROS"] as const;
const PRIORITIES = ["BAIXA", "MEDIA", "ALTA", "URGENTE"] as const;
const STATUSES = ["POR_FAZER", "EM_CURSO", "FEITO", "CANCELADO"] as const;

export const trackerRouter = router({
  list: publicProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        clientId: z.string().optional(),
        status: z.enum(STATUSES).optional(),
        includeCompleted: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.userId) where.userId = input.userId;
      if (input.clientId) where.clientId = input.clientId;
      if (input.status) {
        where.status = input.status;
      } else if (!input.includeCompleted) {
        where.status = { notIn: ["FEITO", "CANCELADO"] };
      }
      return ctx.prisma.trackerTask.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: [
          { status: "asc" },                 // POR_FAZER / EM_CURSO primeiro
          { priority: "desc" },              // URGENTE > ALTA > MEDIA > BAIXA (ord texto nao ideal, melhoramos client-side)
          { deadline: "asc" },
          { createdAt: "desc" },
        ],
      });
    }),

  // Lista tarefas dum cliente agrupadas por membro (para a tab Tracker
  // dentro do workspace). Inclui tarefas de qualquer user com pelo menos
  // uma tarefa para este cliente.
  listByClient: publicProcedure
    .input(z.object({ clientId: z.string(), includeCompleted: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { clientId: input.clientId };
      if (!input.includeCompleted) where.status = { notIn: ["FEITO", "CANCELADO"] };
      const tasks = await ctx.prisma.trackerTask.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
        orderBy: [{ status: "asc" }, { priority: "desc" }, { deadline: "asc" }, { createdAt: "desc" }],
      });
      // Group by user
      const byUser: Record<string, { user: { id: string; name: string; email: string; image: string | null }; tasks: typeof tasks }> = {};
      for (const t of tasks) {
        if (!byUser[t.userId]) byUser[t.userId] = { user: t.user, tasks: [] };
        byUser[t.userId].tasks.push(t);
      }
      return Object.values(byUser).sort((a, b) => a.user.name.localeCompare(b.user.name));
    }),

  stats: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [byStatus, byCategory, overdue, todayDone] = await Promise.all([
        ctx.prisma.trackerTask.groupBy({
          by: ["status"],
          where: { userId: input.userId },
          _count: true,
        }),
        ctx.prisma.trackerTask.groupBy({
          by: ["category"],
          where: { userId: input.userId, status: { notIn: ["FEITO", "CANCELADO"] } },
          _count: true,
        }),
        ctx.prisma.trackerTask.count({
          where: {
            userId: input.userId,
            status: { notIn: ["FEITO", "CANCELADO"] },
            deadline: { lt: new Date() },
          },
        }),
        ctx.prisma.trackerTask.count({
          where: {
            userId: input.userId,
            status: "FEITO",
            completedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        }),
      ]);

      return { byStatus, byCategory, overdue, todayDone };
    }),

  create: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        category: z.enum(CATEGORIES).default("OUTROS"),
        priority: z.enum(PRIORITIES).default("MEDIA"),
        deadline: z.date().nullable().optional(),
        clientId: z.string().nullable().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.trackerTask.create({
        data: {
          userId: input.userId,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          deadline: input.deadline ?? null,
          clientId: input.clientId ?? null,
          notes: input.notes,
        },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          title: z.string().optional(),
          description: z.string().nullable().optional(),
          category: z.enum(CATEGORIES).optional(),
          priority: z.enum(PRIORITIES).optional(),
          status: z.enum(STATUSES).optional(),
          deadline: z.date().nullable().optional(),
          notes: z.string().nullable().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: Record<string, unknown> = { ...input.data };
      // Se marca como FEITO, regista completedAt
      if (input.data.status === "FEITO") {
        data.completedAt = new Date();
      } else if (input.data.status && input.data.status !== "FEITO") {
        data.completedAt = null;
      }
      return ctx.prisma.trackerTask.update({
        where: { id: input.id },
        data,
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.trackerTask.delete({ where: { id: input.id } });
    }),

  toggleStatus: publicProcedure
    .input(z.object({ id: z.string(), status: z.enum(STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.trackerTask.update({
        where: { id: input.id },
        data: {
          status: input.status,
          completedAt: input.status === "FEITO" ? new Date() : null,
        },
      });
    }),
});
