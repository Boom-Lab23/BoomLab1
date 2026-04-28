import { prisma } from "@/lib/prisma";

// Generate action plan draft after a meeting (not sent automatically)
export async function generateActionPlanDraft(sessionId: string): Promise<string> {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { client: true, assignedTo: true },
  });

  // Prefer Fireflies notes, fall back to summary, then to manual notes
  const transcriptSource = session.firefliesNotes
    || session.firefliesSummary
    || session.notes;
  if (!transcriptSource) {
    throw new Error("Sessao sem transcricao nem notas. Faz sync do Fireflies primeiro.");
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY em falta no ambiente.");
  }

  // Get knowledge base
  const knowledgeDocs = await prisma.aIScript.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const knowledgeContext = knowledgeDocs
    .map((d) => `[${d.category ?? d.pillar}] ${d.name}:\n${d.content}`)
    .join("\n\n---\n\n");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: `Es o assistente da BoomLab. Gera um plano de acao pos-reuniao para enviar ao cliente.

CONTEXTO:
- Cliente: ${session.client.name} (${session.client.coreBusiness ?? "N/A"})
- Sessao: ${session.module} / ${session.topic ?? "Geral"}
- Data: ${session.date?.toLocaleDateString("pt-PT") ?? "N/A"}

BASE DE CONHECIMENTO:
${knowledgeContext.slice(0, 20000) || "Sem documentos de referencia."}

INSTRUCOES:
1. Gera um plano de acao claro e profissional para enviar ao cliente
2. Inclui: resumo da reuniao, decisoes tomadas, proximos passos com prazos
3. Tom profissional mas acessivel
4. Formato para enviar por mensagem (canal BoomLab ou email)

Responde em JSON:
{
  "actionPlan": {
    "items": [{"task": "descricao", "responsible": "quem", "deadline": "quando", "priority": "alta|media|baixa"}],
    "nextMeetingTopics": ["topicos"],
    "followUpDate": "data"
  },
  "clientMessage": "mensagem formatada pronta para enviar ao cliente",
  "internalNotes": "notas internas para a equipa (nao enviar ao cliente)"
}`,
      messages: [
        {
          role: "user",
          content: `Transcricao / notas:\n\n${transcriptSource.slice(0, 400000)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[generateActionPlanDraft] Claude API error", response.status, body.slice(0, 300));
    throw new Error(`Claude API error ${response.status}: ${body.slice(0, 120)}`);
  }

  const data = await response.json();
  const text: string = data.content?.[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("[generateActionPlanDraft] Resposta sem JSON:", text.slice(0, 300));
    throw new Error("A IA nao devolveu JSON valido. Tenta novamente.");
  }

  let result: { actionPlan?: { items?: Array<{ task: string; responsible?: string; deadline?: string; priority?: string }>; nextMeetingTopics?: string[]; followUpDate?: string }; clientMessage?: string; internalNotes?: string };
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("[generateActionPlanDraft] JSON parse failed", err);
    throw new Error("Resposta da IA invalida (JSON mal-formado).");
  }

  // Normalize structure - garante que items e sempre um array
  const plan = result.actionPlan ?? { items: [], nextMeetingTopics: [], followUpDate: "" };
  plan.items = Array.isArray(plan.items) ? plan.items : [];
  plan.nextMeetingTopics = Array.isArray(plan.nextMeetingTopics) ? plan.nextMeetingTopics : [];
  plan.followUpDate = plan.followUpDate ?? "";
  result.actionPlan = plan;

  // Save as draft (NOT sent automatically)
  const draft = await prisma.actionPlanDraft.create({
    data: {
      sessionId,
      content: plan as unknown as Record<string, unknown>,
      message: result.clientMessage ?? "",
      status: "DRAFT",
    },
  });

  // Also save action plan on session
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      actionPlan: plan as unknown as Record<string, unknown>,
      actionItems: plan.items.map((i) => i.task) as unknown as object,
    },
  });

  console.log("[generateActionPlanDraft] OK", sessionId, "items:", plan.items.length);
  return draft.id;
}

// Approve and send the action plan
export async function approveAndSendActionPlan(draftId: string): Promise<void> {
  const draft = await prisma.actionPlanDraft.findUniqueOrThrow({
    where: { id: draftId },
    include: { session: { include: { client: true } } },
  });

  await prisma.actionPlanDraft.update({
    where: { id: draftId },
    data: {
      status: "SENT",
      sentAt: new Date(),
      reviewedAt: new Date(),
    },
  });

  await prisma.session.update({
    where: { id: draft.sessionId },
    data: { actionPlanSentAt: new Date() },
  });
}

// Reject draft
export async function rejectActionPlan(draftId: string): Promise<void> {
  await prisma.actionPlanDraft.update({
    where: { id: draftId },
    data: { status: "REJECTED", reviewedAt: new Date() },
  });
}
