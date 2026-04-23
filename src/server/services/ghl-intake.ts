import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail, generateTempPassword } from "./email";

/**
 * Contract do payload que o GHL envia no webhook "Opportunity Stage Changed".
 * Referencia: https://highlevel.stoplight.io/docs/integrations/
 */
export type GhlWebhookPayload = {
  type?: string; // ex: "OpportunityStageChange", "OpportunityStatusChange"
  locationId?: string;
  opportunityId?: string;
  id?: string; // Deal id em alguns formatos
  contactId?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  stageId?: string;
  stageName?: string;
  status?: string; // "won" | "lost" | "open" | "abandoned"
  monetaryValue?: number;
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
  // Alguns workflows enviam os campos no topo
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
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
    email: (contact.email ?? payload.email ?? null)?.toLowerCase().trim() || null,
    phone: contact.phone ?? payload.phone ?? null,
    companyName: contact.companyName ?? payload.companyName ?? null,
  };
}

function isDealWon(payload: GhlWebhookPayload): boolean {
  const status = (payload.status ?? "").toLowerCase();
  if (status === "won") return true;
  const stage = (payload.stageName ?? "").toLowerCase();
  if (stage.includes("fechado") || stage.includes("won") || stage.includes("closed")) return true;
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
  const dealId = payload.opportunityId ?? payload.id ?? payload.opportunity?.id;
  if (!dealId) {
    return { status: "failed", error: "payload sem opportunityId/id" };
  }

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

  const contact = extractContact(payload);

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
              pillars: pillars,
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
          </ul>`,
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
