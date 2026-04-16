import { z } from "zod";
import { router, publicProcedure } from "./init";

export const dashboardsRouter = router({
  // List all client dashboards
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.clientDashboard.findMany({
      include: {
        client: true,
        _count: { select: { records: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }),

  // Get dashboard for a specific client
  getByClientId: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.clientDashboard.findUnique({
      where: { clientId: input },
      include: { client: true },
    });
  }),

  // Get dashboard by ID with records
  getById: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    return ctx.prisma.clientDashboard.findUniqueOrThrow({
      where: { id: input },
      include: {
        client: true,
        records: { orderBy: { date: "desc" }, take: 500 },
      },
    });
  }),

  // Create dashboard for a client
  create: publicProcedure
    .input(z.object({
      clientId: z.string(),
      market: z.enum(["CREDITO", "SEGUROS", "IMOBILIARIO"]),
      commercials: z.array(z.string()).default([]),
      objectives: z.record(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.clientDashboard.create({ data: input });
    }),

  // Update dashboard settings
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      commercials: z.array(z.string()).optional(),
      objectives: z.record(z.number()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.clientDashboard.update({ where: { id }, data });
    }),

  // Add a daily record (End of Day form)
  addRecord: publicProcedure
    .input(z.object({
      dashboardId: z.string(),
      date: z.date(),
      commercial: z.string(),
      channel: z.string().default("Cold Calling"),
      callsMade: z.number().default(0),
      callsAnswered: z.number().default(0),
      callsNotAnswered: z.number().default(0),
      conversions: z.number().default(0),
      // Credito
      escrituras: z.number().optional(),
      creditoHabitacao: z.number().optional(),
      valorCreditoHab: z.number().optional(),
      creditoPessoal: z.number().optional(),
      valorCreditoPes: z.number().optional(),
      cartoes: z.number().optional(),
      valorCartoes: z.number().optional(),
      seguros: z.number().optional(),
      valorSeguros: z.number().optional(),
      // Seguros
      angariacoes: z.number().optional(),
      premios: z.number().optional(),
      apolices: z.number().optional(),
      // Imobiliario
      decisionMakers: z.number().optional(),
      decisionMakersQualified: z.number().optional(),
      valorPremios: z.number().optional(),
      apolicesEmitidas: z.number().optional(),
      taxaSimulacao: z.number().optional(),
      // Pipeline
      agendamentos: z.number().optional(),
      reunioes: z.number().optional(),
      comparecimentos: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const date = new Date(input.date);
      const week = Math.ceil(((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(date.getFullYear(), 0, 1).getDay() + 1) / 7);
      const months = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      const month = months[date.getMonth()];
      const q = Math.floor(date.getMonth() / 3) + 1;
      const convRate = input.callsMade > 0 ? (input.conversions / input.callsMade) * 100 : 0;

      return ctx.prisma.dashboardRecord.create({
        data: {
          ...input,
          date,
          week,
          month,
          trimester: `Q${q}`,
          year: date.getFullYear(),
          conversionRate: convRate,
          showUpRate: input.reunioes && input.comparecimentos
            ? (input.comparecimentos / input.reunioes) * 100
            : undefined,
        },
      });
    }),

  // Get KPIs for a dashboard (aggregated)
  kpis: publicProcedure
    .input(z.object({
      dashboardId: z.string(),
      period: z.enum(["week", "month", "trimester", "year"]).default("month"),
    }))
    .query(async ({ ctx, input }) => {
      const dashboard = await ctx.prisma.clientDashboard.findUniqueOrThrow({
        where: { id: input.dashboardId },
      });

      const now = new Date();
      let dateFilter: Record<string, unknown> = {};

      if (input.period === "week") {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);
        dateFilter = { gte: weekStart };
      } else if (input.period === "month") {
        dateFilter = { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
      } else if (input.period === "trimester") {
        const qStart = Math.floor(now.getMonth() / 3) * 3;
        dateFilter = { gte: new Date(now.getFullYear(), qStart, 1) };
      } else {
        dateFilter = { gte: new Date(now.getFullYear(), 0, 1) };
      }

      const records = await ctx.prisma.dashboardRecord.findMany({
        where: { dashboardId: input.dashboardId, date: dateFilter },
        orderBy: { date: "asc" },
      });

      // Aggregate by commercial
      const byCommercial: Record<string, {
        calls: number; answered: number; conversions: number;
        agendamentos: number; reunioes: number; comparecimentos: number;
        escrituras: number; angariacoes: number; decisionMakers: number;
      }> = {};

      let totalCalls = 0, totalAnswered = 0, totalConversions = 0;
      let totalAgendamentos = 0, totalReunioes = 0, totalComparecimentos = 0;

      for (const r of records) {
        if (!byCommercial[r.commercial]) {
          byCommercial[r.commercial] = { calls: 0, answered: 0, conversions: 0, agendamentos: 0, reunioes: 0, comparecimentos: 0, escrituras: 0, angariacoes: 0, decisionMakers: 0 };
        }
        const c = byCommercial[r.commercial];
        c.calls += r.callsMade;
        c.answered += r.callsAnswered;
        c.conversions += r.conversions;
        c.agendamentos += r.agendamentos ?? 0;
        c.reunioes += r.reunioes ?? 0;
        c.comparecimentos += r.comparecimentos ?? 0;
        c.escrituras += r.escrituras ?? 0;
        c.angariacoes += r.angariacoes ?? 0;
        c.decisionMakers += r.decisionMakers ?? 0;

        totalCalls += r.callsMade;
        totalAnswered += r.callsAnswered;
        totalConversions += r.conversions;
        totalAgendamentos += r.agendamentos ?? 0;
        totalReunioes += r.reunioes ?? 0;
        totalComparecimentos += r.comparecimentos ?? 0;
      }

      return {
        market: dashboard.market,
        period: input.period,
        totalRecords: records.length,
        totals: {
          calls: totalCalls,
          answered: totalAnswered,
          conversions: totalConversions,
          conversionRate: totalCalls > 0 ? (totalConversions / totalCalls) * 100 : 0,
          agendamentos: totalAgendamentos,
          reunioes: totalReunioes,
          comparecimentos: totalComparecimentos,
          showUpRate: totalReunioes > 0 ? (totalComparecimentos / totalReunioes) * 100 : 0,
        },
        byCommercial: Object.entries(byCommercial).map(([name, data]) => ({
          name,
          ...data,
          conversionRate: data.calls > 0 ? (data.conversions / data.calls) * 100 : 0,
        })).sort((a, b) => b.calls - a.calls),
        objectives: dashboard.objectives as Record<string, number> | null,
      };
    }),

  // Growth KPIs - aggregated by week
  growthKpis: publicProcedure
    .input(z.object({ dashboardId: z.string() }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.prisma.dashboardRecord.findMany({
        where: { dashboardId: input.dashboardId },
        orderBy: { date: "asc" },
      });

      // Aggregate by week
      const byWeek: Record<string, {
        week: number; year: number; month: string; trimester: string;
        calls: number; answered: number; conversions: number;
        agendamentos: number; reunioes: number; comparecimentos: number;
        // Credito
        creditoHab: number; creditoPes: number; creditoCon: number; cartoes: number; segurosCross: number;
        // Seguros
        segurosVida: number; segurosSaude: number; segurosAuto: number; segurosHab: number; segurosMulti: number;
        // Imobiliario
        imoAngariacao: number; imoVenda: number; imoArrendamento: number;
      }> = {};

      for (const r of records) {
        const key = `${r.year}-W${r.week}`;
        if (!byWeek[key]) {
          byWeek[key] = {
            week: r.week, year: r.year, month: r.month, trimester: r.trimester,
            calls: 0, answered: 0, conversions: 0, agendamentos: 0, reunioes: 0, comparecimentos: 0,
            creditoHab: 0, creditoPes: 0, creditoCon: 0, cartoes: 0, segurosCross: 0,
            segurosVida: 0, segurosSaude: 0, segurosAuto: 0, segurosHab: 0, segurosMulti: 0,
            imoAngariacao: 0, imoVenda: 0, imoArrendamento: 0,
          };
        }
        const w = byWeek[key];
        w.calls += r.callsMade;
        w.answered += r.callsAnswered;
        w.conversions += r.conversions;
        w.agendamentos += r.agendamentos ?? 0;
        w.reunioes += r.reunioes ?? 0;
        w.comparecimentos += r.comparecimentos ?? 0;
        w.creditoHab += r.creditoHabitacaoN ?? 0;
        w.creditoPes += r.creditoPessoalN ?? 0;
        w.creditoCon += r.creditoConsumoN ?? 0;
        w.cartoes += r.cartoesN ?? 0;
        w.segurosCross += r.segurosCrossN ?? 0;
        w.segurosVida += r.segurosVidaN ?? 0;
        w.segurosSaude += r.segurosSaudeN ?? 0;
        w.segurosAuto += r.segurosAutoN ?? 0;
        w.segurosHab += r.segurosHabitacaoN ?? 0;
        w.segurosMulti += r.segurosMultiN ?? 0;
        w.imoAngariacao += r.imoAngariacaoN ?? 0;
        w.imoVenda += r.imoVendaN ?? 0;
        w.imoArrendamento += r.imoArrendamentoN ?? 0;
      }

      return Object.entries(byWeek)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, data]) => ({ key, label: `S${data.week}`, ...data }));
    }),

  // Chart data - daily aggregated for line charts
  chartData: publicProcedure
    .input(z.object({
      dashboardId: z.string(),
      months: z.number().default(3),
    }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setMonth(since.getMonth() - input.months);

      const records = await ctx.prisma.dashboardRecord.findMany({
        where: { dashboardId: input.dashboardId, date: { gte: since } },
        orderBy: { date: "asc" },
      });

      // Aggregate by day
      const byDay: Record<string, { date: string; calls: number; conversions: number; agendamentos: number; conversionRate: number }> = {};

      for (const r of records) {
        const day = new Date(r.date).toISOString().split("T")[0];
        if (!byDay[day]) byDay[day] = { date: day, calls: 0, conversions: 0, agendamentos: 0, conversionRate: 0 };
        byDay[day].calls += r.callsMade;
        byDay[day].conversions += r.conversions;
        byDay[day].agendamentos += r.agendamentos ?? 0;
      }

      // Calculate conversion rates
      for (const d of Object.values(byDay)) {
        d.conversionRate = d.calls > 0 ? Math.round((d.conversions / d.calls) * 100) : 0;
      }

      return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
    }),

  // Delete dashboard
  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.clientDashboard.delete({ where: { id: input } });
  }),
});
