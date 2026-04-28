import { prisma } from "@/lib/prisma";

// Default delay before feedback becomes visible (hours)
const FEEDBACK_DELAY_HOURS = 4;

type PersonalizedFeedback = {
  feedback: string;
  score: number;
  strengths: string[];
  improvements: string[];
  personalizedScript: string;
  coachingTips: string[];
};

// Generate feedback for a recording, adapted to the commercial's personality
export async function generatePersonalizedFeedback(
  recordingId: string,
  delayHours: number = FEEDBACK_DELAY_HOURS
): Promise<void> {
  const recording = await prisma.recording.findUniqueOrThrow({
    where: { id: recordingId },
    include: { client: true, session: true },
  });

  if (!recording.transcript) return;

  // Get the user who submitted this (from call submissions or session)
  const submission = await prisma.callSubmission.findFirst({
    where: { recordingId },
    include: { user: true },
  });

  const userId = submission?.userId ?? recording.session?.assignedToId;
  if (!userId) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  // Get knowledge base documents
  const knowledgeDocs = await prisma.aIScript.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  const knowledgeContext = knowledgeDocs
    .map((d) => `[${d.category ?? d.pillar}] ${d.name}:\n${d.content}`)
    .join("\n\n---\n\n");

  const salesProfile = user.salesProfile as Record<string, string> | null;

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
      system: `Es um mentor de vendas senior. Vais dar feedback personalizado a um comercial.

COMERCIAL:
- Nome: ${user.name}
- Perfil: ${salesProfile ? JSON.stringify(salesProfile) : "Ainda sem perfil definido"}

CLIENTE DA CHAMADA: ${recording.client.name}
TIPO: ${recording.type === "CALL" ? "Chamada telefonica" : "Reuniao"}

BASE DE CONHECIMENTO (usa como referencia):
${knowledgeContext.slice(0, 30000) || "Sem documentos de referencia ainda."}

INSTRUCOES IMPORTANTES:
1. Da feedback como se fosses um mentor humano, nao uma IA
2. Usa linguagem natural, direta e construtiva
3. Adapta o script sugerido a personalidade deste comercial especifico
4. Se o perfil indica que o comercial e mais introvertido, sugere abordagens mais consultivas
5. Se e mais extrovertido, sugere abordagens mais energeticas
6. Inclui exemplos concretos tirados da chamada

Responde em JSON:
{
  "feedback": "feedback detalhado e humano (3-5 paragrafos)",
  "score": 0-100,
  "strengths": ["pontos fortes com exemplos da chamada"],
  "improvements": ["areas de melhoria com sugestoes praticas"],
  "personalizedScript": "um script adaptado a personalidade deste comercial para situacoes semelhantes",
  "coachingTips": ["dicas de coaching especificas para este comercial"]
}`,
      messages: [
        {
          role: "user",
          content: `Transcricao:\n\n${recording.transcript.slice(0, 400000)}`,
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);

  const data = await response.json();
  const text = data.content[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Falha ao processar resposta da IA");

  const result: PersonalizedFeedback = JSON.parse(jsonMatch[0]);

  // Schedule feedback with delay
  const scheduledFor = new Date();
  scheduledFor.setHours(scheduledFor.getHours() + delayHours);

  await prisma.feedback.create({
    data: {
      recordingId,
      sessionId: recording.sessionId,
      userId,
      content: result.feedback,
      personalizedScript: result.personalizedScript,
      aiScore: result.score,
      status: "PENDING_REVIEW",
      scheduledFor,
    },
  });

  // Update recording score
  await prisma.recording.update({
    where: { id: recordingId },
    data: {
      aiAnalysis: result as unknown as Record<string, unknown>,
      aiScore: result.score,
      analyzedAt: new Date(),
    },
  });
}

// Publish feedback (make visible to user)
export async function publishFeedback(feedbackId: string): Promise<void> {
  await prisma.feedback.update({
    where: { id: feedbackId },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
}

// Get pending feedbacks for admin review
export async function getPendingFeedbacks() {
  return prisma.feedback.findMany({
    where: { status: "PENDING_REVIEW" },
    include: {
      user: true,
      session: { include: { client: true } },
      recording: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

// Auto-publish feedbacks that passed the delay and were reviewed
export async function autoPublishReviewedFeedbacks(): Promise<number> {
  const now = new Date();
  const result = await prisma.feedback.updateMany({
    where: {
      status: "REVIEWED",
      scheduledFor: { lte: now },
    },
    data: {
      status: "PUBLISHED",
      publishedAt: now,
    },
  });
  return result.count;
}
