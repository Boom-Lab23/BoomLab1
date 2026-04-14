import { prisma } from "@/lib/prisma";
import type { AIAnalysisResult } from "@/types";

export async function analyzeRecording(recordingId: string): Promise<AIAnalysisResult> {
  const recording = await prisma.recording.findUniqueOrThrow({
    where: { id: recordingId },
    include: { session: true },
  });

  if (!recording.transcript) {
    throw new Error("Recording has no transcript. Please transcribe first.");
  }

  // Get the AI script for this pillar
  const script = recording.scriptName
    ? await prisma.aIScript.findFirst({
        where: { name: recording.scriptName, isActive: true },
      })
    : await prisma.aIScript.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });

  const systemPrompt = `Es um analista de qualidade de chamadas comerciais.
Analisa a seguinte transcricao de uma ${recording.type === "CALL" ? "chamada" : "reuniao"} e avalia com base nos criterios fornecidos.

${script ? `SCRIPT DE REFERENCIA:\n${script.content}\n\nCRITERIOS DE AVALIACAO:\n${JSON.stringify(script.criteria, null, 2)}` : "Avalia a qualidade geral da comunicacao, profissionalismo, e eficacia comercial."}

Responde APENAS em JSON valido com esta estrutura:
{
  "overallScore": number (0-100),
  "scriptAdherence": number (0-100),
  "criteria": [{ "name": string, "score": number, "maxScore": number, "feedback": string }],
  "strengths": [string],
  "improvements": [string],
  "keyMoments": [{ "timestamp": string, "description": string, "sentiment": "positive"|"negative"|"neutral" }],
  "summary": string
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
          content: `Transcricao da ${recording.type === "CALL" ? "chamada" : "reuniao"}:\n\n${recording.transcript}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.content[0]?.text ?? "";

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse AI response as JSON");

  const analysis: AIAnalysisResult = JSON.parse(jsonMatch[0]);

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
