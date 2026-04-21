import { z } from "zod";
import { router, publicProcedure } from "./init";

const LEAD_STATUS = [
  "NOVA", "CONTACTADA", "QUALIFICADA",
  "REUNIAO_AGENDADA", "REUNIAO_EFETUADA",
  "PROPOSTA_ENVIADA", "NEGOCIACAO",
  "FECHADA_GANHA", "FECHADA_PERDIDA", "EM_PAUSA",
] as const;

export const leadsRouter = router({
  // List leads for a client (optionally filter by commercial)
  list: publicProcedure
    .input(z.object({
      clientId: z.string(),
      commercial: z.string().optional(),
      status: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.lead.findMany({
        where: {
          clientId: input.clientId,
          ...(input.commercial ? { commercial: input.commercial } : {}),
          ...(input.status ? { status: input.status as (typeof LEAD_STATUS)[number] } : {}),
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  // Get commercials with lead counts (for tabs/pages per commercial)
  commercialsWithCounts: publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const leads = await ctx.prisma.lead.findMany({
        where: { clientId: input.clientId },
        select: { commercial: true, status: true },
      });
      const map: Record<string, { total: number; won: number; active: number; lost: number }> = {};
      for (const l of leads) {
        if (!map[l.commercial]) map[l.commercial] = { total: 0, won: 0, active: 0, lost: 0 };
        map[l.commercial].total++;
        if (l.status === "FECHADA_GANHA") map[l.commercial].won++;
        else if (l.status === "FECHADA_PERDIDA") map[l.commercial].lost++;
        else map[l.commercial].active++;
      }
      return Object.entries(map).map(([name, counts]) => ({ name, ...counts }));
    }),

  // Detect duplicates within the same client
  // Two leads are duplicates if they share: same email OR same phone OR same NIF
  duplicates: publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const leads = await ctx.prisma.lead.findMany({
        where: { clientId: input.clientId },
        select: {
          id: true, name: true, commercial: true, email: true, phone: true, nif: true,
          status: true, createdAt: true,
        },
      });

      // Group by any identifier match
      const groups: Record<string, typeof leads> = {};
      const addToGroup = (key: string, lead: typeof leads[number]) => {
        if (!groups[key]) groups[key] = [];
        groups[key].push(lead);
      };

      for (const lead of leads) {
        if (lead.email) addToGroup(`email:${lead.email.toLowerCase()}`, lead);
        if (lead.phone) addToGroup(`phone:${lead.phone.replace(/\s/g, "")}`, lead);
        if (lead.nif) addToGroup(`nif:${lead.nif}`, lead);
      }

      // Return only groups with leads from 2+ different commercials
      const conflicts: Array<{
        matchedBy: string;
        matchedValue: string;
        leads: typeof leads;
        commercials: string[];
      }> = [];
      const seen = new Set<string>();

      for (const [key, groupLeads] of Object.entries(groups)) {
        if (groupLeads.length < 2) continue;
        const commercials = [...new Set(groupLeads.map((l) => l.commercial))];
        if (commercials.length < 2) continue;
        const ids = groupLeads.map((l) => l.id).sort().join(",");
        if (seen.has(ids)) continue;
        seen.add(ids);
        const [matchedBy, matchedValue] = key.split(":");
        conflicts.push({ matchedBy, matchedValue, leads: groupLeads, commercials });
      }

      return conflicts;
    }),

  // Create a new lead - HARD BLOCK if email/phone/NIF already exists in this client
  create: publicProcedure
    .input(z.object({
      clientId: z.string(),
      commercial: z.string().min(1),
      // Empresa (obrigatorio)
      company: z.string().min(1, "Nome da empresa e obrigatorio"),
      companyEmail: z.string().email().optional().or(z.literal("")),
      companyLandline: z.string().optional(),
      companyMobile: z.string().optional(),
      nif: z.string().optional(),
      // Decisor (opcional)
      name: z.string().optional().default(""),        // nome do decisor
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().optional(),                   // nº do decisor
      // Pipeline
      source: z.string().optional(),
      status: z.enum(LEAD_STATUS).default("NOVA"),
      priority: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
      forceCreate: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      // Normalize campos para comparacao
      const normalizedEmail = input.email ? input.email.trim().toLowerCase() : null;
      const normalizedCompanyEmail = input.companyEmail ? input.companyEmail.trim().toLowerCase() : null;
      const normalizedPhone = input.phone ? input.phone.replace(/\s/g, "") : null;
      const normalizedLandline = input.companyLandline ? input.companyLandline.replace(/\s/g, "") : null;
      const normalizedMobile = input.companyMobile ? input.companyMobile.replace(/\s/g, "") : null;
      const normalizedNif = input.nif ? input.nif.trim() : null;

      // Duplicado = match em QUALQUER campo de identificacao (email decisor, email geral,
      // fixo, movel, movel decisor, NIF)
      const orClauses: Record<string, unknown>[] = [];
      if (normalizedEmail) orClauses.push({ email: normalizedEmail });
      if (normalizedCompanyEmail) orClauses.push({ companyEmail: normalizedCompanyEmail });
      if (normalizedPhone) orClauses.push({ phone: normalizedPhone });
      if (normalizedLandline) orClauses.push({ companyLandline: normalizedLandline });
      if (normalizedMobile) orClauses.push({ companyMobile: normalizedMobile });
      if (normalizedNif) orClauses.push({ nif: normalizedNif });

      let duplicateOfId: string | null = null;
      let duplicateOwner: string | null = null;
      let matchedOn: string | null = null;

      if (orClauses.length > 0) {
        const existing = await ctx.prisma.lead.findFirst({
          where: {
            clientId: input.clientId,
            OR: orClauses,
          },
          select: { id: true, commercial: true, name: true, email: true, phone: true, nif: true },
        });
        if (existing) {
          duplicateOfId = existing.id;
          duplicateOwner = existing.commercial;
          // Identificar em que campo deu match
          if (normalizedNif && existing.nif === normalizedNif) matchedOn = "NIF";
          else if (normalizedEmail && existing.email === normalizedEmail) matchedOn = "email decisor";
          else if (normalizedCompanyEmail && (existing as unknown as { companyEmail: string }).companyEmail === normalizedCompanyEmail) matchedOn = "email empresa";
          else if (normalizedPhone && existing.phone === normalizedPhone) matchedOn = "nº decisor";
          else if (normalizedLandline && (existing as unknown as { companyLandline: string }).companyLandline === normalizedLandline) matchedOn = "fixo empresa";
          else if (normalizedMobile && (existing as unknown as { companyMobile: string }).companyMobile === normalizedMobile) matchedOn = "movel empresa";

          // HARD BLOCK: nao deixa criar se ja existe (a menos que forceCreate)
          if (!input.forceCreate) {
            throw new Error(
              `DUPLICADA:${matchedOn}:${duplicateOwner}:${existing.name}`
            );
          }
        }
      }

      // Remove campo forceCreate antes de criar (nao existe no schema)
      const { forceCreate: _forceCreate, ...rest } = input;
      void _forceCreate;

      // Se name vazio, usa o company como fallback (name e obrigatorio no Prisma schema)
      const finalName = rest.name && rest.name.trim().length > 0 ? rest.name : rest.company;

      const lead = await ctx.prisma.lead.create({
        data: {
          ...rest,
          name: finalName,
          email: normalizedEmail,
          companyEmail: normalizedCompanyEmail,
          phone: normalizedPhone,
          companyLandline: normalizedLandline,
          companyMobile: normalizedMobile,
          nif: normalizedNif,
          duplicateOfId,
        },
      });

      return { lead, duplicateWarning: duplicateOwner ? { commercial: duplicateOwner, leadId: duplicateOfId, matchedOn } : null };
    }),

  // Update lead
  update: publicProcedure
    .input(z.object({
      id: z.string(),
      data: z.object({
        name: z.string().optional(),
        company: z.string().optional(),
        companyEmail: z.string().optional(),
        companyLandline: z.string().optional(),
        companyMobile: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        nif: z.string().optional(),
        status: z.enum(LEAD_STATUS).optional(),
        source: z.string().optional(),
        priority: z.string().optional(),
        commercial: z.string().optional(),
        firstContactAt: z.date().optional(),
        lastContactAt: z.date().optional(),
        nextFollowUpAt: z.date().optional(),
        budget: z.number().optional(),
        urgency: z.string().optional(),
        painPoints: z.string().optional(),
        conversionValue: z.number().optional(),
        lostReason: z.string().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const patch = { ...input.data } as Record<string, unknown>;
      // Auto-set convertedAt when status hits FECHADA_GANHA
      if (input.data.status === "FECHADA_GANHA") {
        patch.convertedAt = new Date();
      }
      return ctx.prisma.lead.update({ where: { id: input.id }, data: patch });
    }),

  // Delete lead
  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.lead.delete({ where: { id: input } });
  }),

  // Get lead by id
  getById: publicProcedure.input(z.string()).query(async ({ ctx, input }) => {
    const lead = await ctx.prisma.lead.findUnique({ where: { id: input } });
    if (!lead) return null;
    // Also find any other leads within the same client that share email/phone/nif
    const conflicts = await ctx.prisma.lead.findMany({
      where: {
        clientId: lead.clientId,
        id: { not: lead.id },
        OR: [
          lead.email ? { email: lead.email } : {},
          lead.phone ? { phone: lead.phone } : {},
          lead.nif ? { nif: lead.nif } : {},
        ].filter((c) => Object.keys(c).length > 0),
      },
      select: { id: true, name: true, commercial: true, status: true },
    });
    return { lead, conflicts };
  }),
});
