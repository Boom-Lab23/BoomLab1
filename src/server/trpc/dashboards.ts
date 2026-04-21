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
      // Pipeline comercial (3 etapas distintas)
      reunioesAgendadas: z.number().default(0),  // Reunioes marcadas (pipeline)
      reunioesEfetuadas: z.number().default(0),  // Reunioes que aconteceram
      conversoesFeitas: z.number().default(0),   // Contratos fechados
      // Legacy (kept for compat)
      conversions: z.number().optional(),
      agendamentos: z.number().optional(),
      reunioes: z.number().optional(),
      comparecimentos: z.number().optional(),
      // Credito
      escrituras: z.number().optional(),
      creditoHabitacaoN: z.number().optional(),
      creditoHabitacaoV: z.number().optional(),
      creditoPessoalN: z.number().optional(),
      creditoPessoalV: z.number().optional(),
      creditoConsumoN: z.number().optional(),
      creditoConsumoV: z.number().optional(),
      cartoesN: z.number().optional(),
      cartoesV: z.number().optional(),
      segurosCrossN: z.number().optional(),
      segurosCrossV: z.number().optional(),
      // Seguros
      segurosVidaN: z.number().optional(),
      segurosVidaV: z.number().optional(),
      segurosSaudeN: z.number().optional(),
      segurosSaudeV: z.number().optional(),
      segurosAutoN: z.number().optional(),
      segurosAutoV: z.number().optional(),
      segurosHabitacaoN: z.number().optional(),
      segurosHabitacaoV: z.number().optional(),
      segurosMultiN: z.number().optional(),
      segurosMultiV: z.number().optional(),
      segurosOutrosN: z.number().optional(),
      segurosOutrosV: z.number().optional(),
      angariacoes: z.number().optional(),
      premiosTotal: z.number().optional(),
      apolicesTotal: z.number().optional(),
      // Imobiliario
      decisionMakers: z.number().optional(),
      decisionMakersQualified: z.number().optional(),
      imoAngariacaoN: z.number().optional(),
      imoAngariacaoV: z.number().optional(),
      imoVendaN: z.number().optional(),
      imoVendaV: z.number().optional(),
      imoArrendamentoN: z.number().optional(),
      imoArrendamentoV: z.number().optional(),
      imoComercialN: z.number().optional(),
      imoComercialV: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const date = new Date(input.date);
      const week = Math.ceil(((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(date.getFullYear(), 0, 1).getDay() + 1) / 7);
      const months = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
      const month = months[date.getMonth()];
      const q = Math.floor(date.getMonth() / 3) + 1;

      // New pipeline (3 etapas)
      const reunioesAgendadas = input.reunioesAgendadas || input.agendamentos || 0;
      const reunioesEfetuadas = input.reunioesEfetuadas || input.reunioes || 0;
      const conversoesFeitas = input.conversoesFeitas || input.conversions || 0;

      // Taxas
      const convRate = input.callsMade > 0 ? (conversoesFeitas / input.callsMade) * 100 : 0;
      const showUp = reunioesAgendadas > 0 ? (reunioesEfetuadas / reunioesAgendadas) * 100 : 0;

      return ctx.prisma.dashboardRecord.create({
        data: {
          dashboardId: input.dashboardId,
          date,
          week,
          month,
          trimester: `Q${q}`,
          year: date.getFullYear(),
          commercial: input.commercial,
          channel: input.channel,
          callsMade: input.callsMade,
          callsAnswered: input.callsAnswered,
          callsNotAnswered: input.callsNotAnswered,
          conversions: conversoesFeitas,
          conversoesFeitas,
          reunioesEfetuadas,
          agendamentos: reunioesAgendadas, // campo "reunioes agendadas"
          reunioes: reunioesEfetuadas,     // legacy
          comparecimentos: input.comparecimentos ?? reunioesEfetuadas,
          conversionRate: convRate,
          showUpRate: showUp,
          escrituras: input.escrituras,
          creditoHabitacaoN: input.creditoHabitacaoN,
          creditoHabitacaoV: input.creditoHabitacaoV,
          creditoPessoalN: input.creditoPessoalN,
          creditoPessoalV: input.creditoPessoalV,
          creditoConsumoN: input.creditoConsumoN,
          creditoConsumoV: input.creditoConsumoV,
          cartoesN: input.cartoesN,
          cartoesV: input.cartoesV,
          segurosCrossN: input.segurosCrossN,
          segurosCrossV: input.segurosCrossV,
          segurosVidaN: input.segurosVidaN,
          segurosVidaV: input.segurosVidaV,
          segurosSaudeN: input.segurosSaudeN,
          segurosSaudeV: input.segurosSaudeV,
          segurosAutoN: input.segurosAutoN,
          segurosAutoV: input.segurosAutoV,
          segurosHabitacaoN: input.segurosHabitacaoN,
          segurosHabitacaoV: input.segurosHabitacaoV,
          segurosMultiN: input.segurosMultiN,
          segurosMultiV: input.segurosMultiV,
          segurosOutrosN: input.segurosOutrosN,
          segurosOutrosV: input.segurosOutrosV,
          angariacoes: input.angariacoes,
          premiosTotal: input.premiosTotal,
          apolicesTotal: input.apolicesTotal,
          decisionMakers: input.decisionMakers,
          decisionMakersQualified: input.decisionMakersQualified,
          imoAngariacaoN: input.imoAngariacaoN,
          imoAngariacaoV: input.imoAngariacaoV,
          imoVendaN: input.imoVendaN,
          imoVendaV: input.imoVendaV,
          imoArrendamentoN: input.imoArrendamentoN,
          imoArrendamentoV: input.imoArrendamentoV,
          imoComercialN: input.imoComercialN,
          imoComercialV: input.imoComercialV,
          notes: input.notes,
        },
      });
    }),

  // Get KPIs for a dashboard (aggregated) - with per-channel breakdown
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
        calls: number; answered: number; conversoesFeitas: number;
        reunioesAgendadas: number; reunioesEfetuadas: number;
        escrituras: number; angariacoes: number; decisionMakers: number;
      }> = {};

      // Aggregate by channel (acquisition channel)
      const byChannel: Record<string, {
        calls: number; answered: number; conversoesFeitas: number;
        reunioesAgendadas: number; reunioesEfetuadas: number;
      }> = {};

      let totalCalls = 0, totalAnswered = 0, totalConversoes = 0;
      let totalAgendadas = 0, totalEfetuadas = 0;

      for (const r of records) {
        const conv = r.conversoesFeitas || r.conversions || 0;
        const agendadas = r.agendamentos || 0;  // reunioes agendadas
        const efetuadas = r.reunioesEfetuadas || r.reunioes || 0;

        if (!byCommercial[r.commercial]) {
          byCommercial[r.commercial] = { calls: 0, answered: 0, conversoesFeitas: 0, reunioesAgendadas: 0, reunioesEfetuadas: 0, escrituras: 0, angariacoes: 0, decisionMakers: 0 };
        }
        const c = byCommercial[r.commercial];
        c.calls += r.callsMade;
        c.answered += r.callsAnswered;
        c.conversoesFeitas += conv;
        c.reunioesAgendadas += agendadas;
        c.reunioesEfetuadas += efetuadas;
        c.escrituras += r.escrituras ?? 0;
        c.angariacoes += r.angariacoes ?? 0;
        c.decisionMakers += r.decisionMakers ?? 0;

        const channelKey = r.channel || "outros";
        if (!byChannel[channelKey]) {
          byChannel[channelKey] = { calls: 0, answered: 0, conversoesFeitas: 0, reunioesAgendadas: 0, reunioesEfetuadas: 0 };
        }
        byChannel[channelKey].calls += r.callsMade;
        byChannel[channelKey].answered += r.callsAnswered;
        byChannel[channelKey].conversoesFeitas += conv;
        byChannel[channelKey].reunioesAgendadas += agendadas;
        byChannel[channelKey].reunioesEfetuadas += efetuadas;

        totalCalls += r.callsMade;
        totalAnswered += r.callsAnswered;
        totalConversoes += conv;
        totalAgendadas += agendadas;
        totalEfetuadas += efetuadas;
      }

      return {
        market: dashboard.market,
        period: input.period,
        totalRecords: records.length,
        totals: {
          calls: totalCalls,
          answered: totalAnswered,
          reunioesAgendadas: totalAgendadas,
          reunioesEfetuadas: totalEfetuadas,
          conversoesFeitas: totalConversoes,
          // As 3 taxas distintas do pipeline
          tcAgendamento: totalCalls > 0 ? (totalAgendadas / totalCalls) * 100 : 0,        // Contactos -> Agendadas
          tcShowUp: totalAgendadas > 0 ? (totalEfetuadas / totalAgendadas) * 100 : 0,     // Agendadas -> Efetuadas
          tcFecho: totalEfetuadas > 0 ? (totalConversoes / totalEfetuadas) * 100 : 0,     // Efetuadas -> Conversoes
          // Taxa global (legacy)
          conversionRate: totalCalls > 0 ? (totalConversoes / totalCalls) * 100 : 0,
        },
        byCommercial: Object.entries(byCommercial).map(([name, data]) => ({
          name,
          ...data,
          tcAgendamento: data.calls > 0 ? (data.reunioesAgendadas / data.calls) * 100 : 0,
          tcShowUp: data.reunioesAgendadas > 0 ? (data.reunioesEfetuadas / data.reunioesAgendadas) * 100 : 0,
          tcFecho: data.reunioesEfetuadas > 0 ? (data.conversoesFeitas / data.reunioesEfetuadas) * 100 : 0,
          conversionRate: data.calls > 0 ? (data.conversoesFeitas / data.calls) * 100 : 0,
        })).sort((a, b) => b.calls - a.calls),
        byChannel: Object.entries(byChannel).map(([channel, data]) => ({
          channel,
          ...data,
          pctOfCalls: totalCalls > 0 ? (data.calls / totalCalls) * 100 : 0,
          pctOfConversoes: totalConversoes > 0 ? (data.conversoesFeitas / totalConversoes) * 100 : 0,
          pctOfReunioes: totalEfetuadas > 0 ? (data.reunioesEfetuadas / totalEfetuadas) * 100 : 0,
          tcAgendamento: data.calls > 0 ? (data.reunioesAgendadas / data.calls) * 100 : 0,
          tcShowUp: data.reunioesAgendadas > 0 ? (data.reunioesEfetuadas / data.reunioesAgendadas) * 100 : 0,
          tcFecho: data.reunioesEfetuadas > 0 ? (data.conversoesFeitas / data.reunioesEfetuadas) * 100 : 0,
          conversionRate: data.calls > 0 ? (data.conversoesFeitas / data.calls) * 100 : 0,
        })).sort((a, b) => b.calls - a.calls),
        objectives: dashboard.objectives as Record<string, number> | null,
      };
    }),

  // Growth KPIs - aggregated by week (and by channel)
  growthKpis: publicProcedure
    .input(z.object({ dashboardId: z.string() }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.prisma.dashboardRecord.findMany({
        where: { dashboardId: input.dashboardId },
        orderBy: { date: "asc" },
      });

      // Weekly aggregation with per-channel breakdown
      const byWeek: Record<string, {
        week: number; year: number; month: string; trimester: string;
        calls: number; answered: number;
        conversoesFeitas: number; reunioesEfetuadas: number;
        // Per-channel (dynamic)
        channelCalls: Record<string, number>;
        channelConversoes: Record<string, number>;
        channelReunioes: Record<string, number>;
        // Vertentes
        creditoHab: number; creditoPes: number; creditoCon: number; cartoes: number; segurosCross: number;
        segurosVida: number; segurosSaude: number; segurosAuto: number; segurosHab: number; segurosMulti: number; segurosOutros: number;
        imoAngariacao: number; imoVenda: number; imoArrendamento: number; imoComercial: number;
      }> = {};

      for (const r of records) {
        const key = `${r.year}-W${r.week}`;
        if (!byWeek[key]) {
          byWeek[key] = {
            week: r.week, year: r.year, month: r.month, trimester: r.trimester,
            calls: 0, answered: 0, conversoesFeitas: 0, reunioesEfetuadas: 0,
            channelCalls: {}, channelConversoes: {}, channelReunioes: {},
            creditoHab: 0, creditoPes: 0, creditoCon: 0, cartoes: 0, segurosCross: 0,
            segurosVida: 0, segurosSaude: 0, segurosAuto: 0, segurosHab: 0, segurosMulti: 0, segurosOutros: 0,
            imoAngariacao: 0, imoVenda: 0, imoArrendamento: 0, imoComercial: 0,
          };
        }
        const w = byWeek[key];
        const conv = r.conversoesFeitas || r.conversions || 0;
        const reun = r.reunioesEfetuadas || r.agendamentos || r.reunioes || 0;
        w.calls += r.callsMade;
        w.answered += r.callsAnswered;
        w.conversoesFeitas += conv;
        w.reunioesEfetuadas += reun;

        const channelKey = r.channel || "outros";
        w.channelCalls[channelKey] = (w.channelCalls[channelKey] ?? 0) + r.callsMade;
        w.channelConversoes[channelKey] = (w.channelConversoes[channelKey] ?? 0) + conv;
        w.channelReunioes[channelKey] = (w.channelReunioes[channelKey] ?? 0) + reun;

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
        w.segurosOutros += r.segurosOutrosN ?? 0;
        w.imoAngariacao += r.imoAngariacaoN ?? 0;
        w.imoVenda += r.imoVendaN ?? 0;
        w.imoArrendamento += r.imoArrendamentoN ?? 0;
        w.imoComercial += r.imoComercialN ?? 0;
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

      const byDay: Record<string, { date: string; calls: number; conversoesFeitas: number; reunioesEfetuadas: number; conversionRate: number }> = {};

      for (const r of records) {
        const day = new Date(r.date).toISOString().split("T")[0];
        if (!byDay[day]) byDay[day] = { date: day, calls: 0, conversoesFeitas: 0, reunioesEfetuadas: 0, conversionRate: 0 };
        byDay[day].calls += r.callsMade;
        byDay[day].conversoesFeitas += r.conversoesFeitas || r.conversions || 0;
        byDay[day].reunioesEfetuadas += r.reunioesEfetuadas || r.agendamentos || 0;
      }

      for (const d of Object.values(byDay)) {
        d.conversionRate = d.calls > 0 ? Math.round((d.conversoesFeitas / d.calls) * 100) : 0;
      }

      return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
    }),

  // Delete a single daily record
  deleteRecord: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.dashboardRecord.delete({ where: { id: input } });
  }),

  // Bulk delete records (e.g. clear all records of a given commercial / date range)
  deleteRecords: publicProcedure
    .input(z.object({
      dashboardId: z.string(),
      ids: z.array(z.string()).optional(),
      commercial: z.string().optional(),
      from: z.date().optional(),
      to: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { dashboardId: input.dashboardId };
      if (input.ids && input.ids.length > 0) where.id = { in: input.ids };
      if (input.commercial) where.commercial = input.commercial;
      if (input.from || input.to) {
        where.date = {};
        if (input.from) (where.date as Record<string, unknown>).gte = input.from;
        if (input.to) (where.date as Record<string, unknown>).lte = input.to;
      }
      const result = await ctx.prisma.dashboardRecord.deleteMany({ where });
      return { deleted: result.count };
    }),

  // Delete dashboard
  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.clientDashboard.delete({ where: { id: input } });
  }),
});
