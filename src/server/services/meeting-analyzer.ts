import { prisma } from "@/lib/prisma";
import { sendActionPlanToSlack } from "./slack";

type MeetingAnalysis = {
  summary: string;
  feedback: string;
  score: number;
  strengths: string[];
  improvements: string[];
  actionPlan: {
    items: {
      task: string;
      responsible: string;
      deadline: string;
      priority: "alta" | "media" | "baixa";
    }[];
    nextMeetingTopics: string[];
    followUpDate: string;
  };
  actionItems: string[];
  keyDecisions: string[];
};

// Automatically analyze a meeting when it's completed
// Called by the webhook or when status changes to CONCLUIDA
export async function autoAnalyzeMeeting(sessionId: string): Promise<MeetingAnalysis> {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { client: true, assignedTo: true },
  });

  const transcript = session.firefliesNotes;
  if (!transcript) {
    throw new Error("Sessao sem transcricao. Aguarde o Fireflies processar a reuniao.");
  }

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
      system: `Es um analista de reunioes de consultoria comercial especializado em dar feedback acionavel.

CONTEXTO:
- Cliente: ${session.client.name} (${session.client.coreBusiness ?? "N/A"})
- CEO: ${session.client.ceo ?? "N/A"}
- Tipo: ${session.module} / ${session.topic ?? "Geral"}
- Consultor: ${session.assignedTo?.name ?? "N/A"}
- Data: ${session.date?.toLocaleDateString("pt-PT") ?? "N/A"}
- Dores do cliente: ${session.client.painPoints ?? "N/A"}

TAREFA:
Analisa a transcricao da reuniao e gera:
1. Resumo executivo claro
2. Feedback sobre a qualidade da reuniao
3. Score de 0 a 100
4. Plano de acao concreto com tarefas, responsaveis e deadlines
5. Decisoes-chave tomadas

Responde APENAS em JSON:
{
  "summary": "Resumo executivo em 3-5 frases",
  "feedback": "Feedback construtivo sobre a reuniao",
  "score": 0-100,
  "strengths": ["pontos fortes"],
  "improvements": ["areas de melhoria"],
  "actionPlan": {
    "items": [
      {"task": "descricao", "responsible": "quem", "deadline": "quando", "priority": "alta|media|baixa"}
    ],
    "nextMeetingTopics": ["topicos para a proxima reuniao"],
    "followUpDate": "data sugerida para follow-up"
  },
  "actionItems": ["lista simples de proximos passos"],
  "keyDecisions": ["decisoes tomadas na reuniao"]
}`,
      messages: [
        {
          role: "user",
          content: `Transcricao da reuniao:\n\n${transcript.slice(0, 80000)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0]?.text ?? "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Falha ao processar resposta da IA");

  const analysis: MeetingAnalysis = JSON.parse(jsonMatch[0]);

  // Save everything to the session
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      firefliesSummary: analysis.summary,
      actionItems: analysis.actionItems,
      actionPlan: analysis.actionPlan as unknown as Record<string, unknown>,
      aiAnalysis: analysis as unknown as Record<string, unknown>,
      aiScore: analysis.score,
      evaluation: Math.round(analysis.score / 10),
      status: "CONCLUIDA",
    },
  });

  // Auto-send to Slack if client has a channel configured
  if (session.client.slackChannelId) {
    try {
      await sendActionPlanToSlack(sessionId);
    } catch (err) {
      console.error("Failed to send to Slack:", err);
    }
  }

  return analysis;
}

// Called automatically when Fireflies webhook fires
export async function onMeetingCompleted(sessionId: string): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session?.firefliesNotes) return;
  if (session.aiAnalysis) return; // Already analyzed

  await autoAnalyzeMeeting(sessionId);
}
