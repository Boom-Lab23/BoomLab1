import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import fs from "fs/promises";
import path from "path";
import { sendWelcomeEmail, generateTempPassword } from "./email";
import { getContact, listCustomFields, flattenCustomFields, flattenCustomFieldsByKey } from "./ghl-api";
import { generateContract } from "./contract-generator";
import { createInvoiceForClient } from "./invoice-ninja";

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

  // Tenta enriquecer o contacto com os custom fields do GHL (Dados On-Boarding)
  let customFieldsFlat: Record<string, string> = {};
  let customFieldsByKey: Record<string, string> = {};
  let enrichedFromApi: { address1?: string; city?: string; postalCode?: string; companyName?: string; email?: string; phone?: string; name?: string } = {};
  if (payload.contactId && process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID) {
    try {
      const [ghlContact, cfDefs] = await Promise.all([
        getContact(payload.contactId),
        listCustomFields("contact"),
      ]);
      customFieldsFlat = flattenCustomFields(ghlContact, cfDefs);
      customFieldsByKey = flattenCustomFieldsByKey(ghlContact, cfDefs);
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
      console.warn("[ghl-intake] could not fetch contact from GHL API:", err);
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

      // 2. User GUEST_CLIENT (se houver email)
      let userId: string | null = null;
      let tempPassword: string | undefined;
      if (contact.email) {
        const existingUser = await tx.user.findFirst({
          where: { email: { equals: contact.email, mode: "insensitive" } },
        });
        if (existingUser) {
          userId = existingUser.id;
        } else {
          tempPassword = generateTempPassword();
          const hashed = await bcrypt.hash(tempPassword, 12);
          const user = await tx.user.create({
            data: {
              name: contact.name,
              email: contact.email,
              password: hashed,
              role: "GUEST_CLIENT",
              isActive: true,
              mustChangePassword: true,
              assignedWorkspaceClientId: client.id,
            },
          });
          userId = user.id;
        }
      }

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
      const overrideStr = lookupCustom(`prestacao_${numero}_data`, `prestacao${numero}data`, `${numero}_prestacao_data`);
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
      const valorStr = lookupCustom(`prestacao_${i}_valor`, `prestacao${i}valor`, `${i}_prestacao`, `${i}_prestacao_valor`);
      const valor = Number(valorStr.replace(/[^\d.,-]/g, "").replace(",", "."));
      if (!valor || valor <= 0) continue;
      const data = calcPrestacaoData(i);
      prestacoes.push({ numero: i, valor, data, dataStr: fmtDate2(data) });
    }

    // Detecta paymentMode + outorgantes dos custom fields do GHL
    try {
      const formaPagamento = lookupCustom("forma_pagamento", "formapagamento", "forma_de_pagamento").toLowerCase();
      // Se ha pelo menos 1 prestacao preenchida E forma_pagamento contem 'prest', e PRESTACOES.
      // Senao, AVISTA (mesmo se forma_pagamento estiver vazio).
      const paymentMode = (formaPagamento.includes("prest") && prestacoes.length > 0) ? "PRESTACOES" : "AVISTA";

      const gerente2Name = lookupCustom("gerente_2_nome", "gerente2nome", "segundo_outorgante", "outorgante_2");
      const outorgantes = gerente2Name.trim().length > 0 ? 2 : 1;

      const template = await prisma.contractTemplate.findUnique({
        where: { offer_paymentMode_outorgantes: { offer, paymentMode, outorgantes } },
      });
      if (template && template.isActive) {
        const fmtDate = (d: Date) => d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric" });

        // Datas projecto (custom field ou default)
        const dataInicioStr = lookupCustom("data_inicio", "data_inicio_projecto", "datainicio", "inicio_projecto");
        const dataFimStr = lookupCustom("data_fim", "data_fim_projecto", "datafim", "fim_projecto");
        const dataInicioObj = dataInicioStr ? new Date(dataInicioStr) : dealCloseDate;
        const dataFimObj = dataFimStr ? new Date(dataFimStr) : (() => {
          const d = new Date(dealCloseDate);
          d.setMonth(d.getMonth() + 4);
          return d;
        })();

        // Valor total (avista) ou soma das prestacoes
        const valorTotal = paymentMode === "PRESTACOES"
          ? prestacoes.reduce((s, p) => s + p.valor, 0)
          : Number(payload.monetaryValue ?? payload.opportunity?.monetaryValue ?? 0);

        // Monta as variaveis standard esperadas pelos templates
        const variables: Record<string, string> = {
          // Basicos
          nome: contact.name,
          nome_empresa: lookupCustom("nome_empresa") || contact.companyName || contact.name,
          sede_empresa: lookupCustom("sede_empresa", "sede_da_empresa", "sede") || [enrichedFromApi.address1, enrichedFromApi.postalCode, enrichedFromApi.city].filter(Boolean).join(", "),
          nif_empresa: lookupCustom("nif_empresa", "nif", "nif_numero_de_identificacao_fiscal", "numero_identificacao_fiscal"),
          email: contact.email ?? "",
          telefone: contact.phone ?? "",
          // Gerente 1
          gerente_1_nome: lookupCustom("gerente_1_nome", "gerente1nome", "primeiro_outorgante", "outorgante_1_nome") || contact.name,
          gerente_1_cc: lookupCustom("gerente_1_cc", "gerente1cc", "cc_gerente_1", "outorgante_1_cc"),
          gerente_1_cc_validade: lookupCustom("gerente_1_cc_validade", "validade_cc_gerente_1", "outorgante_1_cc_validade"),
          // Gerente 2 (so usado em templates com 2 outorg.)
          gerente_2_nome: lookupCustom("gerente_2_nome", "gerente2nome", "segundo_outorgante", "outorgante_2_nome"),
          gerente_2_cc: lookupCustom("gerente_2_cc", "gerente2cc", "cc_gerente_2", "outorgante_2_cc"),
          gerente_2_cc_validade: lookupCustom("gerente_2_cc_validade", "validade_cc_gerente_2", "outorgante_2_cc_validade"),
          // Datas
          data_inicio: fmtDate(dataInicioObj),
          data_fim: fmtDate(dataFimObj),
          data_assinatura: fmtDate(dealCloseDate),
          data_hoje: fmtDate(dealCloseDate),
          // Valores
          valor: String(valorTotal),
          valor_total: String(valorTotal),
          // Prestacoes 1-4 (vazias se nao aplicaveis)
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
          morada: lookupCustom("morada", "morada_faturacao", "morada_da_empresa") || enrichedFromApi.address1 || "",
          cidade: lookupCustom("cidade") || enrichedFromApi.city || "",
          codigo_postal: lookupCustom("codigo_postal", "cdigo_postal_da_empresa", "cp") || enrichedFromApi.postalCode || "",
          // Adiciona todos os custom fields do GHL (por name e por key) - para templates custom
          ...customFieldsFlat,
          ...customFieldsByKey,
        };
        const docxBuffer = await generateContract(template.filename, variables);
        // Guarda ficheiro
        await fs.mkdir(DOCUMENTS_DIR, { recursive: true });
        const safeClientName = contact.name.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
        const filename = `contrato-${safeClientName}-${Date.now()}.docx`;
        const filePath = path.join(DOCUMENTS_DIR, result.client.id, filename);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, docxBuffer);
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

        const createdInvoices: Array<{ id: string; number: string; url: string }> = [];

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
                tax_rate1: 23,
              }],
              privateNotes: `BoomLab - prestacao ${p.numero} de ${prestacoes.length}. Cliente: ${result.client.id}`,
            });
            const url = `${process.env.INVOICE_NINJA_URL}/invoices/${inResult.invoiceId}/edit`;
            createdInvoices.push({ id: inResult.invoiceId, number: inResult.invoiceNumber, url });
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
          const amount = payload.monetaryValue ?? payload.opportunity?.monetaryValue ?? 0;
          const inResult = await createInvoiceForClient({
            client: clientInput,
            lines: [{
              notes: `Servicos BoomLab - ${offer}`,
              cost: Number(amount) || 0,
              quantity: 1,
              tax_name1: "IVA",
              tax_rate1: 23,
            }],
            privateNotes: `BoomLab - pagamento avista. Cliente: ${result.client.id}`,
          });
          invoiceId = inResult.invoiceId;
          invoiceNumber = inResult.invoiceNumber;
          const invUrl = `${process.env.INVOICE_NINJA_URL}/invoices/${inResult.invoiceId}/edit`;
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

    // 5. Email de welcome se criamos user novo com password temp
    if (result.tempPassword && result.userId && contact.email) {
      try {
        await sendWelcomeEmail({
          to: contact.email,
          name: contact.name,
          tempPassword: result.tempPassword,
          loginUrl: "https://comunicacao.boomlab.cloud/login",
        });
      } catch (err) {
        console.error("[ghl-intake] Failed to send welcome email:", err);
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
