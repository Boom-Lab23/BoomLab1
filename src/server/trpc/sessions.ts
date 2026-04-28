import { z } from "zod";
import { router, publicProcedure } from "./init";
import { generateActionPlanDraft } from "../services/action-plan-workflow";
import { fetchCalendarEvents, pushPendingSessionsToCalendar, deleteSessionsAndCalendarEvents } from "../services/google-calendar";

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

  // Sessoes que passaram a data sem Fireflies / sem confirmacao.
  // Gestor/consultor escolhe a razao e o sistema atualiza status.
  markMissed: publicProcedure
    .input(z.object({
      id: z.string(),
      reason: z.enum(["REAGENDADA", "CANCELADA", "FIREFLIES_AUSENTE"]),
      newDate: z.date().optional(),  // Necessario se reason=REAGENDADA
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session?.user as Record<string, unknown> | undefined)?.id as string | undefined;
      let newStatus: "REAGENDADA" | "CANCELADA" | "CONCLUIDA";
      if (input.reason === "REAGENDADA") newStatus = "REAGENDADA";
      else if (input.reason === "CANCELADA") newStatus = "CANCELADA";
      else newStatus = "CONCLUIDA"; // Fireflies ausente = considerada feita, sem transcricao

      return ctx.prisma.session.update({
        where: { id: input.id },
        data: {
          status: newStatus,
          missedReason: input.reason,
          missedReasonAt: new Date(),
          missedReasonBy: userId,
          ...(input.reason === "REAGENDADA" && input.newDate ? { date: input.newDate, status: "MARCADA", missedReason: null } : {}),
        },
      });
    }),

  // Sugestoes IA do que abordar nesta reuniao com base no historico de sessoes
  // anteriores deste cliente. Usado em EOM, off-boarding ou qualquer reuniao
  // futura onde o consultor quer um briefing rapido.
  suggestForUpcoming: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const target = await ctx.prisma.session.findUniqueOrThrow({
        where: { id: input.sessionId },
        include: { client: true },
      });

      // Busca todas as sessoes CONCLUIDAS deste cliente com transcricao/notas/action plan
      const past = await ctx.prisma.session.findMany({
        where: {
          clientId: target.clientId,
          status: "CONCLUIDA",
          id: { not: target.id },
          OR: [
            { firefliesNotes: { not: null } },
            { firefliesSummary: { not: null } },
            { actionPlan: { not: undefined } },
            { notes: { not: null } },
          ],
        },
        orderBy: { date: "desc" },
        take: 15, // Ultimas 15 sessoes
      });

      if (past.length === 0) {
        return {
          suggestions: "Sem sessoes anteriores deste cliente para gerar sugestoes baseadas em historico.",
          basedOn: 0,
        };
      }

      // Agrega historico em texto compacto para o Claude
      const historyContext = past
        .map((s, i) => {
          const date = s.date ? new Date(s.date).toLocaleDateString("pt-PT") : "sem data";
          const summary = s.firefliesSummary || s.notes || "(sem resumo)";
          const ap = s.actionPlan ? JSON.stringify(s.actionPlan).slice(0, 1500) : "";
          const ai = s.actionItems ? JSON.stringify(s.actionItems).slice(0, 800) : "";
          return `--- Sessao ${i + 1}: [${date}] ${s.title} (${s.module}) ---
Resumo: ${summary.slice(0, 1200)}
${ap ? `Action Plan: ${ap}` : ""}
${ai ? `Action Items: ${ai}` : ""}`;
        })
        .join("\n\n");

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error("ANTHROPIC_API_KEY em falta.");

      const targetType = (() => {
        if (target.module === "end-of-month") return "End-of-Month (revisao mensal)";
        if (target.module === "off-boarding") return "Off-Boarding (encerramento de projeto)";
        return target.module;
      })();

      const systemPrompt = `Es um assistente da BoomLab a preparar um consultor para uma reuniao com um cliente. Vais analisar o historico de reunioes anteriores e sugerir o que deve ser abordado na proxima reuniao.

Cliente: ${target.client.name}
Tipo de reuniao: ${targetType}
Data prevista: ${target.date ? new Date(target.date).toLocaleDateString("pt-PT") : "sem data"}

Vais ler o historico das ultimas sessoes (mais recente primeiro) e produzir um briefing curto e accionavel:

1) **Pontos pendentes** - action items das sessoes anteriores que ainda nao foram resolvidos
2) **Topicos a abordar** - 3 a 5 topicos especificos para esta reuniao baseado no que foi prometido / discutido / problemas identificados
3) **Perguntas de discovery** - 2 a 3 perguntas para validar progresso desde a ultima sessao
4) **Riscos / Alertas** - se houver sinais de churn, insatisfacao, problemas operacionais

Responde em PT-PT, formato markdown, conciso. Maximo 600 palavras.`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [
            {
              role: "user",
              content: `Historico das ultimas ${past.length} sessoes com este cliente:\n\n${historyContext.slice(0, 100000)}`,
            },
          ],
        }),
      });

      if (!res.ok) {
        throw new Error(`Claude API error: ${res.status} ${await res.text()}`);
      }

      const data = await res.json();
      const suggestions = data.content?.[0]?.text ?? "";

      // Guarda as sugestoes em notes da sessao para nao re-correr Claude desnecessariamente
      await ctx.prisma.session.update({
        where: { id: input.sessionId },
        data: { notes: suggestions },
      });

      return { suggestions, basedOn: past.length };
    }),

  // Lista sessoes que precisam de revisao: MARCADA, data passou, sem firefliesId.
  needsReview: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    return ctx.prisma.session.findMany({
      where: {
        status: "MARCADA",
        date: { lt: now },
        firefliesId: null,
      },
      include: { client: true, assignedTo: true },
      orderBy: { date: "desc" },
    });
  }),

  upcoming: publicProcedure
    .input(z.object({
      assignedToUserId: z.string().optional(),
      clientId: z.string().optional(),
      excludeModules: z.array(z.string()).optional(),
      limit: z.number().default(20),
    }).optional())
    .query(async ({ ctx, input }) => {
      // Instante atual: sessoes passam a "nao proximas" assim que comecam.
      const now = new Date();

      const statusFilter: Record<string, unknown> = {
        OR: [
          { date: { gte: now }, status: { in: ["MARCADA", "AGUARDAR_CONFIRMACAO", "POR_AGENDAR", "REAGENDADA"] } },
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

  // Unified upcoming: Session records + Google Calendar events from team members.
  // Calendar events already linked via calendarEventId are skipped (the Session entry wins).
  upcomingUnified: publicProcedure
    .input(z.object({
      assignedToUserId: z.string().optional(),
      clientId: z.string().optional(),
      excludeModules: z.array(z.string()).optional(),
      daysAhead: z.number().default(30),
      limit: z.number().default(100),
    }).optional())
    .query(async ({ ctx, input }) => {
      // Usar o instante atual (nao o inicio do dia): sessoes que ja comecaram
      // caem automaticamente da lista ao longo do dia.
      const now = new Date();
      const until = new Date(now);
      until.setDate(until.getDate() + (input?.daysAhead ?? 30));

      // 1) DB sessions
      const sessionWhere: Record<string, unknown> = {
        OR: [
          { date: { gte: now, lte: until }, status: { in: ["MARCADA", "AGUARDAR_CONFIRMACAO", "POR_AGENDAR", "REAGENDADA"] } },
          { date: null, status: { in: ["POR_AGENDAR", "AGUARDAR_CONFIRMACAO"] } },
        ],
      };
      if (input?.clientId) sessionWhere.clientId = input.clientId;
      if (input?.excludeModules?.length) sessionWhere.module = { notIn: input.excludeModules };
      if (input?.assignedToUserId) {
        const memberId = input.assignedToUserId;
        const via = await ctx.prisma.session.findMany({
          where: { assignedToId: memberId, status: "CONCLUIDA" },
          select: { clientId: true },
          distinct: ["clientId"],
        });
        const clientIds = via.map((c) => c.clientId);
        sessionWhere.OR = [
          { assignedToId: memberId, date: { gte: now, lte: until } },
          clientIds.length > 0
            ? { clientId: { in: clientIds }, assignedToId: null, date: { gte: now, lte: until } }
            : { id: "__never__" },
        ];
      }

      const dbSessions = await ctx.prisma.session.findMany({
        where: sessionWhere,
        include: { client: true, assignedTo: true },
        orderBy: [{ date: "asc" }, { createdAt: "desc" }],
        take: input?.limit ?? 100,
      });

      const linkedEventIds = new Set(dbSessions.map((s) => s.calendarEventId).filter(Boolean) as string[]);

      // Se filtro por cliente, obter email do cliente para cruzar com attendees
      let clientEmailLc: string | null = null;
      let clientNameLc: string | null = null;
      if (input?.clientId) {
        const cli = await ctx.prisma.client.findUnique({
          where: { id: input.clientId },
          select: { email: true, name: true },
        });
        clientEmailLc = cli?.email?.toLowerCase() ?? null;
        clientNameLc = cli?.name?.toLowerCase() ?? null;
      }

      // 2) Google Calendar events from team members
      const members = await ctx.prisma.user.findMany({
        where: { googleConnected: true, isActive: true, role: { in: ["ADMIN", "MANAGER", "CONSULTANT"] } },
        select: { id: true, name: true, email: true },
      });

      const targetMembers = input?.assignedToUserId
        ? members.filter((m) => m.id === input.assignedToUserId)
        : members;

      const calendarItems: {
        id: string;
        source: "calendar";
        title: string;
        date: Date;
        endDate: Date;
        meetLink: string | null;
        memberId: string;
        memberName: string;
        attendees: string[];
      }[] = [];

      for (const member of targetMembers) {
        try {
          const events = await fetchCalendarEvents(member.id, now, until);
          for (const e of events) {
            if (!e.id || linkedEventIds.has(e.id)) continue;
            if (e.status === "cancelled") continue;
            // Skip events ja terminados
            if (new Date(e.end).getTime() < now.getTime()) continue;
            // Filtrar por cliente: email nos attendees OU nome do cliente no titulo
            if (input?.clientId) {
              const attendeesLc = e.attendees.map((a) => a.toLowerCase());
              const titleLc = e.title.toLowerCase();
              const emailMatch = clientEmailLc ? attendeesLc.includes(clientEmailLc) : false;
              const nameMatch = clientNameLc ? titleLc.includes(clientNameLc) : false;
              if (!emailMatch && !nameMatch) continue;
            }
            calendarItems.push({
              id: `cal:${member.id}:${e.id}`,
              source: "calendar",
              title: e.title,
              date: e.start,
              endDate: e.end,
              meetLink: e.meetLink,
              memberId: member.id,
              memberName: member.name,
              attendees: e.attendees,
            });
          }
        } catch {
          // User without Google connection or expired token — skip silently
        }
      }

      const sessionItems = dbSessions.map((s) => ({
        id: s.id,
        source: "session" as const,
        title: s.title,
        module: s.module,
        date: s.date,
        status: s.status,
        clientId: s.clientId,
        clientName: s.client?.name ?? null,
        assignedToId: s.assignedToId,
        assignedToName: s.assignedTo?.name ?? null,
      }));

      // Merge and sort
      const unified = [
        ...sessionItems.map((s) => ({ ...s, sortDate: s.date ? new Date(s.date).getTime() : Number.MAX_SAFE_INTEGER })),
        ...calendarItems.map((c) => ({ ...c, sortDate: new Date(c.date).getTime() })),
      ].sort((a, b) => a.sortDate - b.sortDate).slice(0, input?.limit ?? 100);

      return unified;
    }),

  // Apaga sessoes da DB e respectivos eventos no Google Calendar (em massa).
  bulkDelete: publicProcedure
    .input(z.object({
      userId: z.string(),
      clientNames: z.array(z.string()).optional(),
      modules: z.array(z.string()).optional(),
      onlyFuture: z.boolean().default(true),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return deleteSessionsAndCalendarEvents(input.userId, {
        clientNames: input.clientNames,
        modules: input.modules,
        onlyFuture: input.onlyFuture,
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
      });
    }),

  // Pusha sessoes MARCADAS sem calendarEventId para o Google Calendar do
  // user indicado. Usa-se uma vez para sincronizar bulk insert.
  pushAllToCalendar: publicProcedure
    .input(z.object({
      userId: z.string(),
      modules: z.array(z.string()).optional(),
      includeClientEmail: z.boolean().default(false),
      onlyForOffboarding: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      return pushPendingSessionsToCalendar(input.userId, {
        onlyFuture: true,
        modules: input.modules,
        includeClientEmail: input.includeClientEmail,
        onlyForOffboarding: input.onlyForOffboarding,
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
