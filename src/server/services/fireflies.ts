import { prisma } from "@/lib/prisma";

const FIREFLIES_API_URL = "https://api.fireflies.ai/graphql";

async function firefliesQuery<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(FIREFLIES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.FIREFLIES_API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Fireflies API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  if (data.errors) {
    throw new Error(`Fireflies GraphQL error: ${JSON.stringify(data.errors)}`);
  }

  return data.data;
}

type FirefliesTranscript = {
  id: string;
  title: string;
  date: string;
  duration: number;
  participants: string[];
  summary: {
    overview: string;
    action_items: string[];
    keywords: string[];
  };
  sentences: {
    text: string;
    speaker_name: string;
    start_time: number;
    end_time: number;
  }[];
};

// Fetch all recent transcripts from Fireflies
export async function fetchRecentTranscripts(limit = 20): Promise<FirefliesTranscript[]> {
  const data = await firefliesQuery<{ transcripts: FirefliesTranscript[] }>(`
    query RecentTranscripts($limit: Int) {
      transcripts(limit: $limit) {
        id
        title
        date
        duration
        participants
        summary {
          overview
          action_items
          keywords
        }
        sentences {
          text
          speaker_name
          start_time
          end_time
        }
      }
    }
  `, { limit });

  return data.transcripts;
}

// Fetch a single transcript by ID
export async function fetchTranscript(transcriptId: string): Promise<FirefliesTranscript> {
  const data = await firefliesQuery<{ transcript: FirefliesTranscript }>(`
    query GetTranscript($id: String!) {
      transcript(id: $id) {
        id
        title
        date
        duration
        participants
        summary {
          overview
          action_items
          keywords
        }
        sentences {
          text
          speaker_name
          start_time
          end_time
        }
      }
    }
  `, { id: transcriptId });

  return data.transcript;
}

// Format sentences into a readable transcript
function formatTranscript(sentences: FirefliesTranscript["sentences"]): string {
  return sentences
    .map((s) => `[${formatTime(s.start_time)}] ${s.speaker_name}: ${s.text}`)
    .join("\n");
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

// Link a Fireflies transcript to an existing session
export async function linkTranscriptToSession(
  transcriptId: string,
  sessionId: string
): Promise<void> {
  const transcript = await fetchTranscript(transcriptId);

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      firefliesId: transcript.id,
      firefliesSummary: transcript.summary?.overview ?? null,
      firefliesNotes: formatTranscript(transcript.sentences),
      actionItems: transcript.summary?.action_items ?? [],
      status: "CONCLUIDA",
    },
  });
}

// Auto-sync: fetch recent Fireflies transcripts and match to sessions
export async function syncFireflies(): Promise<{
  fetched: number;
  matched: number;
  unmatched: string[];
}> {
  const transcripts = await fetchRecentTranscripts(30);
  let matched = 0;
  const unmatched: string[] = [];

  for (const transcript of transcripts) {
    // Skip if already linked
    const existing = await prisma.session.findUnique({
      where: { firefliesId: transcript.id },
    });
    if (existing) continue;

    // Try to match by date
    const meetingDate = new Date(transcript.date);
    const startOfDay = new Date(meetingDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(meetingDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find unlinked sessions on the same day
    const matchingSession = await prisma.session.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        firefliesId: null,
        status: { not: "CONCLUIDA" },
      },
      orderBy: { date: "asc" },
    });

    if (matchingSession) {
      await prisma.session.update({
        where: { id: matchingSession.id },
        data: {
          firefliesId: transcript.id,
          firefliesSummary: transcript.summary?.overview ?? null,
          firefliesNotes: formatTranscript(transcript.sentences),
          actionItems: transcript.summary?.action_items ?? [],
          status: "CONCLUIDA",
        },
      });
      matched++;
    } else {
      unmatched.push(`${transcript.title} (${meetingDate.toLocaleDateString("pt-PT")})`);
    }
  }

  return { fetched: transcripts.length, matched, unmatched };
}

// Generate AI meeting analysis using Claude
export async function analyzeMeeting(sessionId: string): Promise<{
  summary: string;
  feedback: string;
  score: number;
  strengths: string[];
  improvements: string[];
  actionItems: string[];
}> {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { client: true },
  });

  const transcript = session.firefliesNotes;
  if (!transcript) {
    throw new Error("Sessao sem transcricao do Fireflies. Sincronize primeiro.");
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
      system: `Es um analista de reunioes de consultoria comercial. O teu trabalho e analisar reunioes e dar feedback construtivo e acionavel.

Contexto:
- Cliente: ${session.client.name}
- Tipo de sessao: ${session.module} / ${session.topic ?? "Geral"}
- Data: ${session.date?.toLocaleDateString("pt-PT") ?? "N/A"}

Analisa a transcricao e responde APENAS em JSON valido:
{
  "summary": "Resumo executivo da reuniao em 3-5 frases",
  "feedback": "Feedback geral sobre a qualidade da reuniao, comunicacao e eficacia",
  "score": numero de 0 a 100,
  "strengths": ["lista de pontos fortes da reuniao"],
  "improvements": ["lista de areas de melhoria"],
  "actionItems": ["lista de proximos passos concretos identificados"]
}`,
      messages: [
        {
          role: "user",
          content: `Transcricao da reuniao:\n\n${transcript.slice(0, 50000)}`,
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

  const analysis = JSON.parse(jsonMatch[0]);

  // Update session with analysis
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      firefliesSummary: analysis.summary,
      actionItems: analysis.actionItems,
      evaluation: Math.round(analysis.score / 10), // Convert 0-100 to 0-10
    },
  });

  return analysis;
}
