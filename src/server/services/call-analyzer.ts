import { prisma } from "@/lib/prisma";

type CallAnalysis = {
  overallScore: number;
  scriptAdherence: number;
  criteria: {
    name: string;
    score: number;
    maxScore: number;
    feedback: string;
  }[];
  strengths: string[];
  improvements: string[];
  keyMoments: {
    timestamp: string;
    description: string;
    sentiment: "positive" | "negative" | "neutral";
  }[];
  summary: string;
  coachingTips: string[];
};

// Analyze a call recording against a sales script
export async function analyzeCall(recordingId: string): Promise<CallAnalysis> {
  const recording = await prisma.recording.findUniqueOrThrow({
    where: { id: recordingId },
    include: { client: true, session: true },
  });

  if (!recording.transcript) {
    throw new Error("Gravacao sem transcricao. Transcreva primeiro.");
  }

  // Get the relevant AI script for this pillar/type
  const script = recording.scriptName
    ? await prisma.aIScript.findFirst({
        where: { name: recording.scriptName, isActive: true },
      })
    : await prisma.aIScript.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });

  const systemPrompt = `Es um formador de vendas e analista de chamadas comerciais.
O teu trabalho e avaliar chamadas de vendas e dar feedback construtivo para melhorar o desempenho dos comerciais.

${
  script
    ? `SCRIPT DE REFERENCIA:\n${script.content}\n\nCRITERIOS DE AVALIACAO:\n${JSON.stringify(script.criteria, null, 2)}`
    : `CRITERIOS DE AVALIACAO PADRAO:
1. Abertura e Rapport (0-15): Saudacao profissional, apresentacao, criar ligacao
2. Qualificacao (0-20): Perguntas de descoberta, entender necessidades
3. Apresentacao de Valor (0-20): Proposta de valor clara, beneficios relevantes
4. Tratamento de Objecoes (0-15): Resposta a objecoes, empatia, reframing
5. Fecho (0-15): Call-to-action claro, proximo passo definido
6. Profissionalismo (0-15): Tom de voz, linguagem, escuta ativa`
}

CONTEXTO:
- Cliente: ${recording.client.name}
- Tipo: ${recording.type === "CALL" ? "Chamada telefonica" : "Reuniao"}

Analisa a transcricao e responde APENAS em JSON:
{
  "overallScore": 0-100,
  "scriptAdherence": 0-100,
  "criteria": [
    {"name": "nome do criterio", "score": X, "maxScore": Y, "feedback": "feedback especifico"}
  ],
  "strengths": ["pontos fortes com exemplos concretos da chamada"],
  "improvements": ["areas de melhoria com sugestoes praticas"],
  "keyMoments": [
    {"timestamp": "MM:SS", "description": "momento relevante", "sentiment": "positive|negative|neutral"}
  ],
  "summary": "resumo da chamada e avaliacao geral",
  "coachingTips": ["dicas praticas de coaching para o comercial melhorar"]
}`;

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
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Transcricao da chamada:\n\n${recording.transcript.slice(0, 80000)}`,
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

  const analysis: CallAnalysis = JSON.parse(jsonMatch[0]);

  // Save to database
  await prisma.recording.update({
    where: { id: recordingId },
    data: {
      aiAnalysis: analysis as unknown as Record<string, unknown>,
      aiScore: analysis.overallScore,
      analyzedAt: new Date(),
    },
  });

  return analysis;
}

// Auto-analyze: when a recording is uploaded with a transcript
export async function autoAnalyzeIfReady(recordingId: string): Promise<void> {
  const recording = await prisma.recording.findUnique({
    where: { id: recordingId },
  });

  if (!recording?.transcript) return;
  if (recording.aiAnalysis) return; // Already analyzed

  await analyzeCall(recordingId);
}
