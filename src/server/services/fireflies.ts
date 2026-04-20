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
  audio_url: string | null;
  video_url: string | null;
  summary: {
    overview: string;
    action_items: string[];
    keywords: string[];
    shorthand_bullet: string[];
    notes: string;
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
        audio_url
        video_url
        summary {
          overview
          action_items
          keywords
          shorthand_bullet
          notes
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

// Fetch a single transcript by ID (with audio/video/notes)
export async function fetchTranscript(transcriptId: string): Promise<FirefliesTranscript> {
  const data = await firefliesQuery<{ transcript: FirefliesTranscript }>(`
    query GetTranscript($id: String!) {
      transcript(id: $id) {
        id
        title
        date
        duration
        participants
        audio_url
        video_url
        summary {
          overview
          action_items
          keywords
          shorthand_bullet
          notes
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

  // Format notes from Fireflies
  const firefliesNotes = formatTranscript(transcript.sentences);
  const sessionNotes = transcript.summary?.notes || transcript.summary?.shorthand_bullet?.join("\n") || null;

  await prisma.session.update({
    where: { id: sessionId },
    data: {
      firefliesId: transcript.id,
      firefliesSummary: transcript.summary?.overview ?? null,
      firefliesNotes: firefliesNotes,
      notes: sessionNotes, // Auto-fill session notes from Fireflies
      actionItems: transcript.summary?.action_items ?? [],
      firefliesRecordingUrl: `https://app.fireflies.ai/view/${transcript.id}`,
      status: "CONCLUIDA",
    },
  });

  // Create a recording entry with audio/video URL
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (session) {
    const recordingUrl = transcript.video_url || transcript.audio_url || `https://app.fireflies.ai/view/${transcript.id}`;

    await prisma.recording.create({
      data: {
        title: `${transcript.title} - Gravacao`,
        type: "MEETING",
        duration: transcript.duration ? Math.round(transcript.duration * 60) : null,
        fileUrl: recordingUrl,
        transcript: firefliesNotes,
        clientId: session.clientId,
        sessionId: session.id,
      },
    });
  }
}

// Auto-sync: fetch recent Fireflies transcripts and match to sessions
// If no matching session exists, creates one automatically.
export async function syncFireflies(): Promise<{
  fetched: number;
  matched: number;
  created: number;
  skipped: number;
  details: Array<{ title: string; action: "matched" | "created" | "skipped"; sessionId?: string }>;
}> {
  const { categorizeByTitle } = await import("./session-categorizer");
  const transcripts = await fetchRecentTranscripts(50);
  let matched = 0;
  let created = 0;
  let skipped = 0;
  const details: Array<{ title: string; action: "matched" | "created" | "skipped"; sessionId?: string }> = [];

  // Ensure catch-all client exists (single upsert outside loop)
  const catchAll = await prisma.client.upsert({
    where: { id: "__catchall_meetings__" },
    update: {},
    create: { id: "__catchall_meetings__", name: "Reunioes por classificar", status: "ATIVO" },
  });

  for (const transcript of transcripts) {
    // Idempotency
    const existing = await prisma.session.findUnique({ where: { firefliesId: transcript.id } });
    if (existing) {
      skipped++;
      details.push({ title: transcript.title, action: "skipped", sessionId: existing.id });
      continue;
    }

    // Parse Fireflies date (can be ISO string or numeric ms string)
    const rawDate = transcript.date;
    const asNum = Number(rawDate);
    const meetingDate = !Number.isNaN(asNum) && asNum > 0
      ? new Date(asNum)
      : new Date(rawDate);

    // Widen window to +/- 24h
    const windowStart = new Date(meetingDate.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd = new Date(meetingDate.getTime() + 24 * 60 * 60 * 1000);

    const matchingSession = await prisma.session.findFirst({
      where: {
        date: { gte: windowStart, lte: windowEnd },
        firefliesId: null,
      },
      orderBy: { date: "asc" },
    });

    const firefliesNotes = formatTranscript(transcript.sentences);
    const sessionNotes = transcript.summary?.notes
      || transcript.summary?.shorthand_bullet?.join("\n")
      || transcript.summary?.overview
      || null;
    const recordingUrl = transcript.video_url || transcript.audio_url || `https://app.fireflies.ai/view/${transcript.id}`;

    let sessionId: string;
    let clientIdForRec: string;

    if (matchingSession) {
      const upd = await prisma.session.update({
        where: { id: matchingSession.id },
        data: {
          firefliesId: transcript.id,
          firefliesSummary: transcript.summary?.overview ?? null,
          firefliesNotes,
          notes: sessionNotes,
          actionItems: (transcript.summary?.action_items ?? []) as unknown as object,
          firefliesRecordingUrl: `https://app.fireflies.ai/view/${transcript.id}`,
          status: "CONCLUIDA",
        },
      });
      sessionId = upd.id;
      clientIdForRec = upd.clientId;
      matched++;
      details.push({ title: transcript.title, action: "matched", sessionId });
    } else {
      // Auto-create session
      const cat = categorizeByTitle(transcript.title ?? "Reuniao");
      const participants: string[] = Array.isArray(transcript.participants) ? transcript.participants : [];

      let clientId: string = catchAll.id;
      if (participants.length > 0) {
        const emailMatch = await prisma.client.findFirst({ where: { email: { in: participants } } });
        if (emailMatch) clientId = emailMatch.id;
        else {
          // try name guess from external domain
          for (const p of participants) {
            const dom = p.split("@")[1];
            if (!dom || /(gmail|hotmail|outlook|boomlab)\.(com|pt|agency)/i.test(dom)) continue;
            const guess = dom.split(".")[0];
            const nameMatch = await prisma.client.findFirst({ where: { name: { contains: guess, mode: "insensitive" } } });
            if (nameMatch) { clientId = nameMatch.id; break; }
          }
        }
      }

      let assignedToId: string | null = null;
      if (participants.length > 0) {
        const userMatch = await prisma.user.findFirst({ where: { email: { in: participants } } });
        if (userMatch) assignedToId = userMatch.id;
      }

      const newSession = await prisma.session.create({
        data: {
          title: transcript.title ?? "Reuniao",
          module: cat.module ?? "Outros",
          topic: transcript.title ?? null,
          date: meetingDate,
          status: "CONCLUIDA",
          clientId,
          assignedToId,
          firefliesId: transcript.id,
          firefliesSummary: transcript.summary?.overview ?? null,
          firefliesNotes,
          notes: sessionNotes,
          firefliesRecordingUrl: `https://app.fireflies.ai/view/${transcript.id}`,
          actionItems: (transcript.summary?.action_items ?? []) as unknown as object,
        },
      });
      sessionId = newSession.id;
      clientIdForRec = newSession.clientId;
      created++;
      details.push({ title: transcript.title, action: "created", sessionId });
    }

    // Recording
    await prisma.recording.create({
      data: {
        title: `${transcript.title} - Gravacao`,
        type: "MEETING",
        duration: transcript.duration ? Math.round(transcript.duration * 60) : null,
        fileUrl: recordingUrl,
        transcript: firefliesNotes,
        clientId: clientIdForRec,
        sessionId,
      },
    });
  }

  return { fetched: transcripts.length, matched, created, skipped, details };
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
      evaluation: Math.round(analysis.score / 10),
    },
  });

  return analysis;
}
