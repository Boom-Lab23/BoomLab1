import { prisma } from "@/lib/prisma";
// bcrypt removido — user GUEST_CLIENT ja nao e criado automaticamente
import fs from "fs/promises";
import path from "path";
import { sendClientOnboardingEmail } from "./email";
import { getContact, getOpportunity, listCustomFields, flattenCustomFields, flattenCustomFieldsByKey } from "./ghl-api";
import { generateContract } from "./contract-generator";
import { createInvoiceForClient, fetchInvoicePdf } from "./invoice-ninja";

// Pasta onde guardamos documentos gerados (contratos, etc.)
const DOCUMENTS_DIR = process.env.GENERATED_DOCS_DIR ?? "/tmp/boomlab-generated-docs";

/**
 * Contract do payload que o GHL envia no webhook "Opportunity Stage Changed".
 * Referencia: https://highlevel.stoplight.io/docs/integrations/
 */
export type GhlWebhookPayload = {
  type?: string; // ex: "OpportunityStageChange", "OpportunityStatusChange"
  locationId?: string;
  opportunityId?: string;
  id?: string; // Deal id em alguns formatos (TOP LEVEL no webhook GHL)
  contactId?: string;
  contact_id?: string; // Formato GHL nativo (snake_case)
  pipelineId?: string;
  pipeline_id?: string; // Formato GHL nativo
  pipelineStageId?: string;
  pipeline_stage_id?: string;
  stageId?: string;
  stageName?: string;
  pipeline_stage_name?: string;
  pipeline_name?: string;
  status?: string; // "won" | "lost" | "open" | "abandoned"
  monetaryValue?: number;
  lead_value?: number; // Formato GHL nativo
  contact?: {
    id?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    companyName?: string;
  };
  opportunity?: {
    id?: string;
    name?: string;
    monetaryValue?: number;
  };
  workflow?: {
    id?: string;
    name?: string;
  };
  // Alguns workflows enviam os campos no topo
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  tags?: string;
  source?: string;
  // Custom Data passado pelo workflow (chaves manuais)
  customData?: Record<string, unknown>;
};

type ExtractedContact = {
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
};

function extractContact(payload: GhlWebhookPayload): ExtractedContact {
  const contact = payload.contact ?? {};
  const firstName = contact.firstName ?? payload.first_name ?? "";
  const lastName = contact.lastName ?? payload.last_name ?? "";
  const name =
    contact.name ??
    payload.name ??
    payload.full_name ??
    `${firstName} ${lastName}`.trim() ??
    "Cliente GHL";
  return {
    name: name || "Cliente GHL",
    email: ((contact.email ?? payload.email ?? null)?.toLowerCase().trim()) || null,
    phone: contact.phone ?? payload.phone ?? null,
    companyName: contact.companyName ?? payload.companyName ?? null,
  };
}

function isDealWon(payload: GhlWebhookPayload): boolean {
  const status = (payload.status ?? "").toLowerCase();
  if (status === "won") return true;
  const stage = (payload.stageName ?? payload.pipeline_stage_name ?? "").toLowerCase();
  // Apanha: "fechado", "fechada", "fechado (cash collected)", "won", "closed", "concluido", etc.
  const stageMatch = (s: string) =>
    s.includes("fechad") ||
    s.includes("won") ||
    s.includes("closed") ||
    s.includes("conclu") ||
    s.includes("cash collected") ||
    s.includes("ganho");
  if (stage && stageMatch(stage)) return true;
  // Fallback: se o nome do workflow indica claramente que so dispara em
  // stage de fim (ex: "Webhook Stage Fechada"), confiamos no trigger.
  // Isto resolve o caso onde GHL nao envia stageName mas o workflow tem
  // filtro que so aciona em "Fechado (cash collected)".
  const workflowName = (payload.workflow?.name ?? "").toLowerCase();
  if (workflowName && stageMatch(workflowName)) return true;
  return false;
}

export type GhlIntakeResult =
  | { status: "processed"; clientId: string; userId: string | null; channelId: string | null; tempPassword?: string }
  | { status: "skipped"; reason: string }
  | { status: "duplicate"; existingEventId: string }
  | { status: "failed"; error: string };

/**
 * Processa um webhook do GHL. Idempotente por ghlDealId+stageId.
 */
export async function processGhlWebhook(payload: GhlWebhookPayload): Promise<GhlIntakeResult> {
  // GHL Webhook nativo envia o `id` no top level (que e o opportunity id quando
  // o trigger e Pipeline Stage Changed). Tambem aceita customData.opportunityId
  // ou opportunity.id se vier dum custom payload.
  const customData = (payload.customData as Record<string, unknown> | undefined) ?? {};
  const dealId =
    payload.opportunityId ??
    (customData.opportunityId as string | undefined) ??
    payload.opportunity?.id ??
    payload.id;
  if (!dealId) {
    return { status: "failed", error: "payload sem opportunityId/id" };
  }

  // Normaliza os campos GHL snake_case (do webhook nativo) para os
  // camelCase que o resto do codigo espera. customData tem precedencia
  // se o user explicitamente mapeou variaveis.
  if (!payload.contactId) payload.contactId = (customData.contactId as string | undefined) ?? payload.contact_id;
  if (!payload.pipelineId) payload.pipelineId = (customData.pipelineId as string | undefined) ?? payload.pipeline_id;
  if (!payload.pipelineStageId) payload.pipelineStageId = (customData.pipelineStageId as string | undefined) ?? payload.pipeline_stage_id;
  if (!payload.stageName) payload.stageName = (customData.stageName as string | undefined) ?? payload.pipeline_stage_name;
  if (payload.monetaryValue == null) {
    const fromCustom = customData.monetaryValue ? Number(customData.monetaryValue) : null;
    payload.monetaryValue = fromCustom ?? payload.lead_value ?? undefined;
  }
  if (!payload.full_name) payload.full_name = (customData.full_name as string | undefined) ?? payload.full_name;

  // Idempotencia: se ja processamos este deal para stage 'won', saltamos
  const existingProcessed = await prisma.ghlEvent.findFirst({
    where: {
      ghlDealId: dealId,
      status: "processed",
    },
  });
  if (existingProcessed) {
    return { status: "duplicate", existingEventId: existingProcessed.id };
  }

  // So processamos se o deal passou para "won" / fechado
  if (!isDealWon(payload)) {
    const eventRow = await prisma.ghlEvent.create({
      data: {
        ghlDealId: dealId,
        ghlContactId: payload.contactId ?? null,
        ghlPipelineId: payload.pipelineId ?? null,
        ghlStageId: payload.pipelineStageId ?? payload.stageId ?? null,
        stageName: payload.stageName ?? null,
        status: "skipped",
        error: `status=${payload.status ?? ""} stage=${payload.stageName ?? ""} (nao e fechado ganho)`,
        payload: payload as unknown as Record<string, unknown>,
        processedAt: new Date(),
      },
    });
    return { status: "skipped", reason: `evento registado (${eventRow.id}) mas nao e fechado ganho` };
  }

  // Mapear pipeline -> oferta
  let offer = "Consultoria";
  let pillars: string[] = [];
  if (payload.pipelineId) {
    const mapping = await prisma.ghlPipelineMapping.findUnique({
      where: { ghlPipelineId: payload.pipelineId },
    });
    if (mapping && mapping.isActive) {
      offer = mapping.offer;
      pillars = mapping.defaultPillars ?? [];
    }
  }

  // Tenta enriquecer o contacto e a opportunity com os custom fields do GHL.
  // IMPORTANTE: muitos campos de "Dados Onboarding" estao na OPPORTUNITY (nao no
  // CONTACT), por isso buscamos ambos e fazemos merge dos custom fields.
  let customFieldsFlat: Record<string, string> = {};
  let customFieldsByKey: Record<string, string> = {};
  let enrichedFromApi: { address1?: string; city?: string; postalCode?: string; companyName?: string; email?: string; phone?: string; name?: string } = {};
  if (process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID) {
    try {
      // Custom field defs de ambos os models
      const [contactDefs, oppDefs] = await Promise.all([
        listCustomFields("contact"),
        listCustomFields("opportunity"),
      ]);

      // Contact (se houver contactId)
      if (payload.contactId) {
        try {
          const ghlContact = await getContact(payload.contactId);
          const contactByName = flattenCustomFields(ghlContact, contactDefs);
          const contactByKey = flattenCustomFieldsByKey(ghlContact, contactDefs);
          customFieldsFlat = { ...customFieldsFlat, ...contactByName };
          customFieldsByKey = { ...customFieldsByKey, ...contactByKey };
          enrichedFromApi = {
            name: ghlContact.name ?? ([ghlContact.firstName, ghlContact.lastName].filter(Boolean).join(" ") || undefined),
            email: ghlContact.email?.toLowerCase().trim(),
            phone: ghlContact.phone ?? undefined,
            companyName: ghlContact.companyName ?? undefined,
            address1: ghlContact.address1,
            city: ghlContact.city,
            postalCode: ghlContact.postalCode,
          };
        } catch (err) {
          console.warn("[ghl-intake] failed contact fetch:", err);
        }
      }

      // Opportunity (Dados Onboarding ficam aqui em muitas configuracoes)
      try {
        const opp = await getOpportunity(dealId);
        // Override monetaryValue com o valor real da opportunity se vazio
        if (payload.monetaryValue == null && opp.monetaryValue != null) {
          payload.monetaryValue = opp.monetaryValue;
        }
        // Merge custom fields da opportunity (cf da opp tem precedencia para
        // campos que so existem na opp como prestao_*, valor_contrato, etc).
        // IMPORTANTE: GHL devolve cada custom field como { id, fieldValue }
        // (NOT { id, value }). Por isso lemos cf.fieldValue como prioridade.
        const oppCustom = opp.customFields ?? [];
        const oppDefsById: Record<string, { id: string; name?: string; fieldKey?: string }> = {};
        for (const def of oppDefs) oppDefsById[def.id] = def;
        const ghlCfReader = (cf: { fieldValue?: unknown; value?: unknown }): string => {
          const raw = cf.fieldValue ?? cf.value;
          if (raw == null) return "";
          if (typeof raw === "string") return raw;
          if (Array.isArray(raw)) return raw.join(", ");
          return String(raw);
        };
        for (const cf of oppCustom as Array<{ id: string; fieldValue?: unknown; value?: unknown }>) {
          const def = oppDefsById[cf.id];
          if (!def) continue;
          const valStr = ghlCfReader(cf);
          if (!valStr) continue;
          if (def.name) customFieldsFlat[def.name] = valStr;
          const key = (def.fieldKey ?? "").replace(/^opportunity\./, "");
          if (key) customFieldsByKey[key] = valStr;
        }
      } catch (err) {
        console.warn("[ghl-intake] failed opportunity fetch:", err);
      }
    } catch (err) {
      console.warn("[ghl-intake] could not fetch GHL data:", err);
    }
  }

  const fallbackContact = extractContact(payload);
  const contact = {
    name: enrichedFromApi.name ?? fallbackContact.name,
    email: enrichedFromApi.email ?? fallbackContact.email,
    phone: enrichedFromApi.phone ?? fallbackContact.phone,
    companyName: enrichedFromApi.companyName ?? fallbackContact.companyName,
  };

  // Usa email como unique - se ja existe cliente/user com este email, liga a ele
  let existingClient = null;
  if (contact.email) {
    existingClient = await prisma.client.findFirst({
      where: { email: { equals: contact.email, mode: "insensitive" } },
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Cliente
      // Nota: pillars sao atribuidos via mapping GhlPipelineMapping.defaultPillars mas
      // o modelo Client nao tem o campo - para futuro usamos via ClientPillar join table
      void pillars; // usado mais tarde quando implementarmos ClientPillar
      const client = existingClient
        ? existingClient
        : await tx.client.create({
            data: {
              name: contact.name,
              email: contact.email,
              phone: contact.phone,
              ceo: contact.name,
              coreBusiness: contact.companyName,
              status: "PRE_ARRANQUE",
              offer: [offer],
              projectStart: new Date(),
              billing: payload.monetaryValue ?? payload.opportunity?.monetaryValue ?? null,
            } as Record<string, unknown>,
          });

      // 2. User GUEST_CLIENT — DESACTIVADO
      // Por decisao do produto: o cliente NAO recebe acesso a plataforma
      // automaticamente quando fecha um deal. Recebe apenas email com
      // contrato + fatura. Se a equipa quiser conceder acesso depois, faz
      // manualmente em /admin/users.
      const userId: string | null = null;
      const tempPassword: string | undefined = undefined;

      // 3. Canal de mensagens (tipo CLIENT) para a equipa BoomLab + este cliente
      let channelId: string | null = null;
      const existingChannel = await tx.channel.findFirst({
        where: { clientId: client.id, type: "CLIENT" },
      });
      if (existingChannel) {
        channelId = existingChannel.id;
      } else {
        // Precisa de um createdById - usa o primeiro admin encontrado
        const admin = await tx.user.findFirst({
          where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
          orderBy: { createdAt: "asc" },
        });
        if (admin) {
          const channel = await tx.channel.create({
            data: {
              name: client.name,
              type: "CLIENT",
              clientId: client.id,
              createdById: admin.id,
              isPrivate: true,
              description: `Canal de comunicacao com ${client.name}`,
              members: {
                create: [
                  { userId: admin.id, role: "OWNER" },
                  ...(userId && userId !== admin.id ? [{ userId: userId, role: "MEMBER" as const }] : []),
                ],
              },
            },
          });
          channelId = channel.id;

          // Liga o canal ao user convidado
          if (userId) {
            await tx.user.update({
              where: { id: userId },
              data: { assignedChannelId: channel.id },
            });
          }
        }
      }

      return { client, userId, channelId, tempPassword };
    });

    // 3.5. Gerar contrato DOCX a partir do template da oferta (best-effort)
    let contractDocId: string | null = null;
    let contractDocxBuffer: Buffer | undefined;
    let contractFilename: string | undefined;

    // ============================================================
    // Lookup helper que tolera variacoes de fieldKey (com/sem
    // acentos, com/sem snake_case prefix). O GHL gera fieldKeys
    // automaticamente do label (ex: "Nif (Número...)" -> "nif_nmero...").
    // ============================================================
    const lookupCustom = (...candidates: string[]): string => {
      for (const cand of candidates) {
        const norm = cand.toLowerCase().replace(/[^a-z0-9]/g, "");
        // 1) match exacto por fieldKey
        if (customFieldsByKey[cand]) return String(customFieldsByKey[cand]);
        // 2) match por fieldKey normalizado
        for (const [k, v] of Object.entries(customFieldsByKey)) {
          if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === norm && v) return String(v);
        }
        // 3) match por nome de campo (case-insensitive)
        for (const [k, v] of Object.entries(customFieldsFlat)) {
          if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === norm && v) return String(v);
        }
      }
      return "";
    };

    // ============================================================
    // Calcula prestacoes (1 a 4) com valor + data
    // Hibrido: 1a data = fecho do deal; 2a-4a = +30/+60/+90 dias
    // (override possivel via custom field prestacao_N_data).
    // ============================================================
    type PrestacaoInfo = { numero: number; valor: number; data: Date; dataStr: string };
    const dealCloseDate = new Date();
    const calcPrestacaoData = (numero: number): Date => {
      // GHL fieldKeys: prestao_2__data, prestao_3__data, prestao_4__data
      // (note dois underscores e "prestao" sem c-cedilha)
      const overrideStr = lookupCustom(
        `prestao_${numero}__data`, `prestacao_${numero}_data`,
        `prestacao${numero}data`, `${numero}_prestacao_data`,
        `Prestação ${numero} - Data`
      );
      if (overrideStr) {
        const d = new Date(overrideStr);
        if (!Number.isNaN(d.getTime())) return d;
      }
      const offsetDays = (numero - 1) * 30;
      const d = new Date(dealCloseDate);
      d.setDate(d.getDate() + offsetDays);
      return d;
    };
    const fmtDate2 = (d: Date) => d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });
    const prestacoes: PrestacaoInfo[] = [];
    for (let i = 1; i <= 4; i++) {
      // GHL fieldKey real: prestao_1__valor, prestao_2__valor, etc
      const valorStr = lookupCustom(
        `prestao_${i}__valor`, `prestacao_${i}_valor`,
        `prestacao${i}valor`, `${i}_prestacao`, `${i}_prestacao_valor`,
        `Prestação ${i} - Valor`
      );
      const valor = Number(valorStr.replace(/[^\d.,-]/g, "").replace(",", "."));
      if (!valor || valor <= 0) continue;
      const data = calcPrestacaoData(i);
      prestacoes.push({ numero: i, valor, data, dataStr: fmtDate2(data) });
    }

    // Detecta paymentMode + outorgantes dos custom fields do GHL
    // GHL fieldKey real: 'upfrontprestaes' (RADIO com opcoes Upfront/Prestações)
    try {
      const formaPagamento = lookupCustom(
        "upfrontprestaes", "Upfront/Prestações", "forma_pagamento",
        "formapagamento", "forma_de_pagamento"
      ).toLowerCase();
      // Detecta PRESTACOES por: contem 'prest' OU ha pelo menos 1 prestacao preenchida.
      // Senao AVISTA.
      const paymentMode = (formaPagamento.includes("prest") || prestacoes.length > 0) ? "PRESTACOES" : "AVISTA";

      // Outorgante 2: GHL tem 'nome_segundo_gerente' (sem 'gerente_2_nome')
      const gerente2Name = lookupCustom(
        "nome_segundo_gerente", "Nome Segundo Gerente",
        "gerente_2_nome", "gerente2nome", "segundo_outorgante", "outorgante_2"
      );
      const outorgantes = gerente2Name.trim().length > 0 ? 2 : 1;

      const template = await prisma.contractTemplate.findUnique({
        where: { offer_paymentMode_outorgantes: { offer, paymentMode, outorgantes } },
      });
      if (template && template.isActive) {
        const fmtDate = (d: Date) => d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });

        // Datas projecto (GHL fieldKeys reais: incio_do_contrato, fim_contrato)
        const dataInicioStr = lookupCustom("incio_do_contrato", "Início do Contrato", "data_inicio", "data_inicio_projecto");
        const dataFimStr = lookupCustom("fim_contrato", "final_do_contrato", "Fim do Contrato", "data_fim", "data_fim_projecto");
        const dataInicioObj = dataInicioStr ? new Date(dataInicioStr) : dealCloseDate;
        const dataFimObj = dataFimStr ? new Date(dataFimStr) : (() => {
          const d = new Date(dealCloseDate);
          d.setMonth(d.getMonth() + 4);
          return d;
        })();

        // Valor total: prioritiza valor_contrato (custom field GHL) > payload.monetaryValue > opportunity.monetaryValue
        const valorContratoStr = lookupCustom("valor_contrato", "Valor Contrato");
        const valorContratoNum = Number(valorContratoStr.replace(/[^\d.,-]/g, "").replace(",", "."));
        const valorTotal = paymentMode === "PRESTACOES"
          ? prestacoes.reduce((s, p) => s + p.valor, 0)
          : (valorContratoNum > 0 ? valorContratoNum : Number(payload.monetaryValue ?? payload.opportunity?.monetaryValue ?? 0));

        // Override monetaryValue para o invoice ninja usar o valor correcto
        if (valorContratoNum > 0 && (payload.monetaryValue == null || payload.monetaryValue === 0)) {
          payload.monetaryValue = valorContratoNum;
        }

        // Helpers para apresentacao no contrato (pt-PT, formato monetario)
        const fmtEur = (n: number) => `${n.toLocaleString("pt-PT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}€`;
        const numeroExtenso = (n: number): string => {
          // 1.a, 2.a, 3.a, 4.a (forma feminina porque "prestacao" e feminino)
          return `${n}.ª`;
        };

        // Array de prestacoes para Docxtemplater iterar com {#prestacoes}...{/prestacoes}
        // Cada item tem propriedades acessiveis no template: {numero}, {numero_extenso},
        // {valor}, {valor_eur}, {data}
        const prestacoesArray = prestacoes.map((p) => ({
          numero: p.numero,
          numero_extenso: numeroExtenso(p.numero),
          valor: p.valor,
          valor_eur: fmtEur(p.valor),
          data: p.dataStr,
        }));

        // Monta as variaveis standard esperadas pelos templates
        // GHL fieldKeys reais: nome_comercial_de_empresa, nif_nmero_de_identificao_fiscal,
        // sede_da_empresa, cdigo_postal_da_empresa, morada
        const variables: Record<string, unknown> = {
          // Basicos
          nome: contact.name,
          nome_empresa: lookupCustom("nome_comercial_de_empresa", "Nome Comercial de Empresa", "nome_empresa", "nome_da_empresa") || contact.companyName || contact.name,
          sede_empresa: lookupCustom("sede_da_empresa", "Sede da empresa", "sede_empresa", "sede") || [enrichedFromApi.address1, enrichedFromApi.postalCode, enrichedFromApi.city].filter(Boolean).join(", "),
          nif_empresa: lookupCustom("nif_nmero_de_identificao_fiscal", "Nif (Número de Identificação Fiscal)", "nif_empresa", "nif"),
          email: contact.email ?? "",
          telefone: contact.phone ?? "",
          // Gerente 1: GHL nao tem fields especificos para o 1o outorgante,
          // por isso usa o nome do contacto + nada para CC (a menos que adicione no futuro)
          gerente_1_nome: lookupCustom("gerente_1_nome", "Nome Primeiro Gerente", "primeiro_outorgante") || contact.name,
          gerente_1_cc: lookupCustom("gerente_1_cc", "Gerente 1 cc"),
          gerente_1_cc_validade: lookupCustom("gerente_1_cc_validade", "Gerente 1 cc validade"),
          // Gerente 2: GHL tem 'nome_segundo_gerente', 'gerente_2_cc', 'gerente_2_cc_validade'
          gerente_2_nome: lookupCustom("nome_segundo_gerente", "Nome Segundo Gerente", "gerente_2_nome"),
          gerente_2_cc: lookupCustom("gerente_2_cc", "Gerente 2 cc"),
          gerente_2_cc_validade: lookupCustom("gerente_2_cc_validade", "Gerente 2 cc validade"),
          // Datas
          data_inicio: fmtDate(dataInicioObj),
          data_fim: fmtDate(dataFimObj),
          data_assinatura: fmtDate(dealCloseDate),
          data_hoje: fmtDate(dealCloseDate),
          // Valores
          valor: String(valorTotal),
          valor_total: String(valorTotal),
          valor_total_eur: fmtEur(valorTotal),
          // Array para loop Docxtemplater: {#prestacoes}{numero_extenso} {valor_eur} - {data}{/prestacoes}
          prestacoes: prestacoesArray,
          // Prestacoes 1-4 (vazias se nao aplicaveis) - mantidos para retrocompatibilidade
          prestacao_1_valor: prestacoes[0] ? String(prestacoes[0].valor) : "",
          prestacao_1_data: prestacoes[0]?.dataStr ?? "",
          prestacao_2_valor: prestacoes[1] ? String(prestacoes[1].valor) : "",
          prestacao_2_data: prestacoes[1]?.dataStr ?? "",
          prestacao_3_valor: prestacoes[2] ? String(prestacoes[2].valor) : "",
          prestacao_3_data: prestacoes[2]?.dataStr ?? "",
          prestacao_4_valor: prestacoes[3] ? String(prestacoes[3].valor) : "",
          prestacao_4_data: prestacoes[3]?.dataStr ?? "",
          numero_prestacoes: String(prestacoes.length),
          forma_pagamento: paymentMode,
          // Legacy fallbacks (templates antigos)
          primeira_prestacao: prestacoes[0] ? String(prestacoes[0].valor) : String(valorTotal),
          restantes_prestacoes: prestacoes.slice(1).map((p) => `${p.valor}€ a ${p.dataStr}`).join("; "),
          oferta: offer,
          empresa: contact.companyName ?? "",
          morada: lookupCustom("morada", "Morada", "morada_faturacao", "morada_da_empresa") || enrichedFromApi.address1 || "",
          cidade: lookupCustom("cidade", "Cidade") || enrichedFromApi.city || "",
          codigo_postal: lookupCustom("cdigo_postal_da_empresa", "Código Postal da empresa", "codigo_postal", "cp") || enrichedFromApi.postalCode || "",
          // Adiciona todos os custom fields do GHL (por name e por key) - para templates custom
          ...customFieldsFlat,
          ...customFieldsByKey,
        };
        // Cast: 'variables' contem mistura de strings, arrays de objectos
        // (prestacoes) e spread de customFields. generateContract aceita esses
        // tipos atraves do tipo ContractVarValue interno.
        const docxBuffer = await generateContract(template.filename, variables as Parameters<typeof generateContract>[1]);
        // Guarda ficheiro
        await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
        const safeClientName = contact.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
        const filename = `contrato-${safeClientName}-${Date.now()}.docx`;
        const filePath = path.join(DOCUMENTS_DIR, result.client.id, filename);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, docxBuffer);
        // Mantem em memoria para anexar ao onboarding email
        contractDocxBuffer = docxBuffer;
        contractFilename = `Contrato BoomLab - ${contact.name}.docx`;
        // Regista Document
        const doc = await prisma.document.create({
          data: {
            title: `Contrato ${offer} - ${contact.name}`,
            pillar: "contratos",
            filePath,
            fileMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            fileSizeBytes: docxBuffer.length,
            source: "ghl-contract",
            clientId: result.client.id,
          },
        });
        contractDocId = doc.id;
      }
    } catch (err) {
      console.error("[ghl-intake] contract generation failed (continuing):", err);
    }

    // 3.6. Criar Client + Invoice draft(s) no Invoice Ninja (best-effort)
    // Se AVISTA: 1 fatura com valor total. Se PRESTACOES: N faturas (uma
    // por prestacao) com due_date = data da prestacao. Todas em rascunho.
    let invoiceId: string | null = null;
    let invoiceNumber: string | null = null;
    try {
      if (process.env.INVOICE_NINJA_URL && process.env.INVOICE_NINJA_TOKEN) {
        // Determina formaPagamento + lista de prestacoes (calculadas no bloco anterior)
        const formaPagamento = lookupCustom("forma_pagamento", "formapagamento", "forma_de_pagamento").toLowerCase();
        const isPrestacoes = formaPagamento.includes("prest") && prestacoes.length > 0;

        const clientInput = {
          name: contact.companyName || contact.name,
          email: contact.email,
          contacts: contact.email ? [{
            first_name: contact.name.split(" ")[0],
            last_name: contact.name.split(" ").slice(1).join(" ") || "-",
            email: contact.email,
            phone: contact.phone ?? undefined,
          }] : undefined,
          phone: contact.phone ?? undefined,
          address1: enrichedFromApi.address1,
          city: enrichedFromApi.city,
          postal_code: enrichedFromApi.postalCode,
          vat_number: lookupCustom("nif_empresa", "nif", "nif_numero_de_identificacao_fiscal") || undefined,
          id_number: lookupCustom("cc", "gerente_1_cc") || undefined,
          private_notes: `Criado automaticamente via GHL (deal ${dealId}) - oferta ${offer}`,
        };

        const createdInvoices: Array<{
          id: string;
          number: string;
          url: string;
          amount: number;
          dueDate?: string;
          prestacaoLabel?: string;
        }> = [];

        if (isPrestacoes) {
          // Cria uma fatura por prestacao (em rascunho)
          for (const p of prestacoes) {
            const dueDateStr = p.data.toISOString().slice(0, 10); // YYYY-MM-DD
            const inResult = await createInvoiceForClient({
              client: clientInput,
              dueDate: dueDateStr,
              lines: [{
                notes: `Servicos BoomLab - ${offer} (prestacao ${p.numero}/${prestacoes.length})`,
                cost: p.valor,
                quantity: 1,
                tax_name1: "IVA",
                tax_rate1: 0,
              }],
              privateNotes: `BoomLab - prestacao ${p.numero} de ${prestacoes.length}. Cliente: ${result.client.id}`,
            });
            const url = `${process.env.INVOICE_NINJA_URL}/invoices/${inResult.invoiceId}/edit`;
            createdInvoices.push({
              id: inResult.invoiceId,
              number: inResult.invoiceNumber,
              url,
              amount: p.valor,
              dueDate: p.dataStr,
              prestacaoLabel: `${p.numero} de ${prestacoes.length}`,
            });
            await prisma.document.create({
              data: {
                title: `Fatura ${inResult.invoiceNumber} - Prestacao ${p.numero}/${prestacoes.length} - ${contact.name}`,
                pillar: "faturas",
                source: "invoice-ninja",
                externalId: inResult.invoiceId,
                externalUrl: url,
                clientId: result.client.id,
              },
            });
          }
          if (createdInvoices.length > 0) {
            invoiceId = createdInvoices[0].id;
            invoiceNumber = createdInvoices[0].number;
          }
        } else {
          // AVISTA: 1 fatura com valor total
          const amount = Number(payload.monetaryValue ?? payload.opportunity?.monetaryValue ?? 0) || 0;
          const inResult = await createInvoiceForClient({
            client: clientInput,
            lines: [{
              notes: `Servicos BoomLab - ${offer}`,
              cost: amount,
              quantity: 1,
              tax_name1: "IVA",
              tax_rate1: 0,
            }],
            privateNotes: `BoomLab - pagamento avista. Cliente: ${result.client.id}`,
          });
          invoiceId = inResult.invoiceId;
          invoiceNumber = inResult.invoiceNumber;
          const invUrl = `${process.env.INVOICE_NINJA_URL}/invoices/${inResult.invoiceId}/edit`;
          createdInvoices.push({
            id: inResult.invoiceId,
            number: inResult.invoiceNumber,
            url: invUrl,
            amount,
          });
          await prisma.document.create({
            data: {
              title: `Fatura ${inResult.invoiceNumber} - ${contact.name}`,
              pillar: "faturas",
              source: "invoice-ninja",
              externalId: inResult.invoiceId,
              externalUrl: invUrl,
              clientId: result.client.id,
            },
          });
        }

        // Notifica contabilidade@boomlab.agency das faturas criadas
        if (createdInvoices.length > 0) {
          try {
            const { sendAccountingInvoiceNotification } = await import("./email");
            await sendAccountingInvoiceNotification({
              clientName: contact.companyName || contact.name,
              clientEmail: contact.email,
              offer,
              invoices: createdInvoices.map((i) => ({
                invoiceNumber: i.number,
                amount: i.amount,
                dueDate: i.dueDate,
                prestacaoLabel: i.prestacaoLabel,
                invoiceUrl: i.url,
              })),
            });
          } catch (err) {
            console.error("[ghl-intake] Failed to notify contabilidade:", err);
          }
        }
      }
    } catch (err) {
      console.error("[ghl-intake] Invoice Ninja integration failed (continuing):", err);
    }

    // 4. Regista o evento como processado
    await prisma.ghlEvent.create({
      data: {
        ghlDealId: dealId,
        ghlContactId: payload.contactId ?? null,
        ghlPipelineId: payload.pipelineId ?? null,
        ghlStageId: payload.pipelineStageId ?? payload.stageId ?? null,
        stageName: payload.stageName ?? null,
        status: "processed",
        payload: payload as unknown as Record<string, unknown>,
        createdClientId: result.client.id,
        createdUserId: result.userId ?? null,
        createdChannelId: result.channelId ?? null,
        processedAt: new Date(),
      },
    });

    // 5. Email de onboarding ao cliente (sem login da plataforma)
    // Envia welcome + contrato em anexo + fatura em anexo (ou link).
    // Cliente NAO recebe credenciais - so a equipa BoomLab tem acesso.
    if (contact.email) {
      try {
        // Tenta puxar PDF da 1a fatura criada
        let invoicePdfBuffer: Buffer | undefined;
        let invoiceFilename: string | undefined;
        if (invoiceId && process.env.INVOICE_NINJA_URL) {
          try {
            invoicePdfBuffer = await fetchInvoicePdf(invoiceId);
            invoiceFilename = `Fatura ${invoiceNumber ?? invoiceId} - ${contact.name}.pdf`;
          } catch (err) {
            console.warn("[ghl-intake] Falhou fetch invoice PDF, vai mandar link:", err);
          }
        }
        const invoiceUrl = invoiceId
          ? `${process.env.INVOICE_NINJA_URL}/invoices/${invoiceId}/edit`
          : undefined;

        // Reunioes agendadas no GHL (campos TEXT - texto livre, ex: "12/05/2026 as 14:30")
        const reuniaoPreArranque = lookupCustom(
          "data_e_hora_da_reunio_de_prarranque",
          "Data e hora da reunião de pré-arranque",
          "reuniao_pre_arranque", "reuniao_prearranque"
        );
        const reuniaoLevantamento = lookupCustom(
          "data_e_hora_da_reunio_de_levantamento",
          "Data e hora da reunião de Levantamento",
          "reuniao_levantamento"
        );

        await sendClientOnboardingEmail({
          to: contact.email,
          clientName: contact.companyName || contact.name,
          contactName: contact.name,
          contractDocxBuffer,
          contractFilename,
          invoicePdfBuffer,
          invoiceFilename,
          reuniaoPreArranque: reuniaoPreArranque || undefined,
          reuniaoLevantamento: reuniaoLevantamento || undefined,
          cc: "guilherme@boomlab.agency", // CC para a equipa receber copia
        });
      } catch (err) {
        console.error("[ghl-intake] Failed to send onboarding email:", err);
      }
    }

    // 6. Notifica a equipa BoomLab por email (best-effort)
    try {
      const { sendEmail } = await import("./email");
      await sendEmail({
        to: "guilherme@boomlab.agency",
        subject: `🎉 Novo cliente fechado via GHL: ${contact.name}`,
        html: `<h2>Novo cliente criado automaticamente via GoHighLevel</h2>
          <p><strong>Nome:</strong> ${contact.name}</p>
          <p><strong>Email:</strong> ${contact.email ?? "-"}</p>
          <p><strong>Empresa:</strong> ${contact.companyName ?? "-"}</p>
          <p><strong>Oferta:</strong> ${offer}</p>
          <p><strong>Valor:</strong> ${payload.monetaryValue ?? "-"}</p>
          <ul>
            <li>Cliente criado: <a href="https://servico.boomlab.cloud/clients/${result.client.id}">Ver no BoomLab</a></li>
            ${result.channelId ? `<li>Canal: <a href="https://servico.boomlab.cloud/messaging/${result.channelId}">Abrir canal</a></li>` : ""}
            ${result.userId ? `<li>Utilizador guest criado com password temporaria enviada por email</li>` : "<li>Sem email do contacto - nao foi criado user</li>"}
            ${contractDocId ? `<li>Contrato gerado: <a href="https://servico.boomlab.cloud/clients/${result.client.id}">ver em Documentos</a></li>` : "<li>Sem template de contrato para esta oferta - gere manualmente</li>"}
            ${invoiceId ? `<li>Invoice Ninja: fatura <strong>${invoiceNumber}</strong> criada em rascunho</li>` : "<li>Invoice Ninja nao configurado - fatura por criar</li>"}
          </ul>
          <p style="color: #666; font-size: 12px;">Custom fields do GHL disponiveis: ${Object.keys(customFieldsFlat).join(", ") || "nenhum"}</p>`,
      });
    } catch (err) {
      console.error("[ghl-intake] Failed to notify team:", err);
    }

    return {
      status: "processed",
      clientId: result.client.id,
      userId: result.userId,
      channelId: result.channelId,
      tempPassword: result.tempPassword,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Regista o erro
    await prisma.ghlEvent.create({
      data: {
        ghlDealId: dealId,
        ghlContactId: payload.contactId ?? null,
        ghlPipelineId: payload.pipelineId ?? null,
        ghlStageId: payload.pipelineStageId ?? payload.stageId ?? null,
        stageName: payload.stageName ?? null,
        status: "failed",
        error: msg,
        payload: payload as unknown as Record<string, unknown>,
        processedAt: new Date(),
      },
    });
    return { status: "failed", error: msg };
  }
}
