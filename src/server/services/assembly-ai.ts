// AssemblyAI integration for deep audio analysis
// Docs: https://www.assemblyai.com/docs/
//
// Provides:
// - Audio upload (file or URL)
// - Transcription (PT-PT)
// - Sentiment analysis
// - Speaker diarization (labels A/B or names)
// - Disfluencies (uhm, tipo, pronto, pausas)
// - Word-level timestamps (ms precision)
// - LeMUR: LLM over audio for complex Q&A

const ASSEMBLYAI_API = "https://api.assemblyai.com/v2";

function apiKey(): string {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) throw new Error("ASSEMBLYAI_API_KEY em falta no ambiente.");
  return key;
}

// ============================================================
// Upload local file (Buffer) to AssemblyAI temporary storage
// ============================================================
export async function uploadAudioBuffer(buffer: Buffer): Promise<string> {
  const res = await fetch(`${ASSEMBLYAI_API}/upload`, {
    method: "POST",
    headers: {
      authorization: apiKey(),
      "Content-Type": "application/octet-stream",
    },
    body: buffer as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`AssemblyAI upload failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.upload_url as string;
}

// ============================================================
// Submit transcription job
// ============================================================
export interface TranscriptionParams {
  audioUrl: string;
  languageCode?: "pt" | "en" | "auto";
  speakerLabels?: boolean;
  sentimentAnalysis?: boolean;
  disfluencies?: boolean;
  autoChapters?: boolean;
  entityDetection?: boolean;
}

export async function submitTranscription(params: TranscriptionParams): Promise<string> {
  const body: Record<string, unknown> = {
    audio_url: params.audioUrl,
    language_code: params.languageCode ?? "pt",
    speaker_labels: params.speakerLabels ?? true,
    sentiment_analysis: params.sentimentAnalysis ?? true,
    disfluencies: params.disfluencies ?? true,
    auto_chapters: params.autoChapters ?? true,
    entity_detection: params.entityDetection ?? false,
    punctuate: true,
    format_text: true,
  };

  const res = await fetch(`${ASSEMBLYAI_API}/transcript`, {
    method: "POST",
    headers: {
      authorization: apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AssemblyAI transcribe submit failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}

// ============================================================
// Poll until transcription is complete
// ============================================================
export interface AssemblyTranscript {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  error?: string;
  text?: string;
  audio_duration?: number; // seconds
  language_code?: string;
  confidence?: number;
  words?: Array<{ text: string; start: number; end: number; speaker?: string; confidence: number }>;
  utterances?: Array<{ speaker: string; text: string; start: number; end: number; words: unknown[] }>;
  sentiment_analysis_results?: Array<{ text: string; sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL"; confidence: number; start: number; end: number; speaker?: string }>;
  chapters?: Array<{ summary: string; headline: string; gist: string; start: number; end: number }>;
  disfluencies?: boolean;
}

export async function getTranscript(transcriptId: string): Promise<AssemblyTranscript> {
  const res = await fetch(`${ASSEMBLYAI_API}/transcript/${transcriptId}`, {
    headers: { authorization: apiKey() },
  });
  if (!res.ok) throw new Error(`AssemblyAI get transcript failed: ${res.status}`);
  return (await res.json()) as AssemblyTranscript;
}

export async function waitForTranscription(
  transcriptId: string,
  opts: { pollMs?: number; timeoutMs?: number } = {}
): Promise<AssemblyTranscript> {
  const pollMs = opts.pollMs ?? 5_000;
  const timeoutMs = opts.timeoutMs ?? 20 * 60 * 1000; // 20 min
  const start = Date.now();
  while (true) {
    const t = await getTranscript(transcriptId);
    if (t.status === "completed") return t;
    if (t.status === "error") throw new Error(`AssemblyAI transcription error: ${t.error ?? "unknown"}`);
    if (Date.now() - start > timeoutMs) throw new Error("AssemblyAI transcription timeout.");
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

// ============================================================
// Compute delivery metrics from transcript
// ============================================================
export interface DeliveryMetrics {
  durationSeconds: number;
  wordCount: number;
  wordsPerMinute: number;
  speakers: Array<{
    speaker: string;
    wordCount: number;
    talkTimePct: number;         // % do tempo total
    wpm: number;
    avgUtteranceSec: number;
  }>;
  totalSilenceSec: number;       // pausas > 1.5s entre palavras
  longestPauseSec: number;
  fillerWords: {
    total: number;
    byWord: Record<string, number>;
    perMinute: number;
  };
  interruptions: number;          // quando speaker muda sem pausa > 0.3s
  sentimentBreakdown: {
    positive: number;
    negative: number;
    neutral: number;
  };
}

const FILLERS = ["uhm", "hum", "tipo", "pronto", "sabe", "sabes", "tipo assim", "ta", "né", "basicamente", "literalmente", "portanto", "vá", "entao"];

export function computeDeliveryMetrics(t: AssemblyTranscript): DeliveryMetrics {
  const words = t.words ?? [];
  const utterances = t.utterances ?? [];
  const durationSec = (t.audio_duration ?? 0);
  const durationMin = durationSec / 60;

  // Speakers breakdown
  const speakerMap: Record<string, { wordCount: number; durationMs: number; utterances: number }> = {};
  for (const u of utterances) {
    const sp = u.speaker || "?";
    if (!speakerMap[sp]) speakerMap[sp] = { wordCount: 0, durationMs: 0, utterances: 0 };
    speakerMap[sp].wordCount += u.text.split(/\s+/).length;
    speakerMap[sp].durationMs += (u.end - u.start);
    speakerMap[sp].utterances++;
  }
  const totalSpeakerMs = Object.values(speakerMap).reduce((s, v) => s + v.durationMs, 0) || 1;

  const speakers = Object.entries(speakerMap).map(([speaker, v]) => ({
    speaker,
    wordCount: v.wordCount,
    talkTimePct: (v.durationMs / totalSpeakerMs) * 100,
    wpm: durationMin > 0 ? v.wordCount / ((v.durationMs / 1000) / 60) : 0,
    avgUtteranceSec: v.utterances > 0 ? (v.durationMs / 1000) / v.utterances : 0,
  }));

  // Pauses (gaps > 1.5s between adjacent words)
  let totalSilenceMs = 0;
  let longestPauseMs = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > 1500) {
      totalSilenceMs += gap;
      if (gap > longestPauseMs) longestPauseMs = gap;
    }
  }

  // Filler words count
  const fillerCounts: Record<string, number> = {};
  let totalFillers = 0;
  for (const w of words) {
    const lower = w.text.toLowerCase().replace(/[.,!?]/g, "");
    if (FILLERS.includes(lower)) {
      fillerCounts[lower] = (fillerCounts[lower] ?? 0) + 1;
      totalFillers++;
    }
  }

  // Interruptions (utterance change with gap < 0.3s)
  let interruptions = 0;
  for (let i = 1; i < utterances.length; i++) {
    if (utterances[i].speaker !== utterances[i - 1].speaker) {
      const gap = utterances[i].start - utterances[i - 1].end;
      if (gap < 300) interruptions++;
    }
  }

  // Sentiment
  const sent = { positive: 0, negative: 0, neutral: 0 };
  for (const s of t.sentiment_analysis_results ?? []) {
    if (s.sentiment === "POSITIVE") sent.positive++;
    else if (s.sentiment === "NEGATIVE") sent.negative++;
    else sent.neutral++;
  }

  const wpm = durationMin > 0 ? words.length / durationMin : 0;

  return {
    durationSeconds: durationSec,
    wordCount: words.length,
    wordsPerMinute: wpm,
    speakers,
    totalSilenceSec: totalSilenceMs / 1000,
    longestPauseSec: longestPauseMs / 1000,
    fillerWords: {
      total: totalFillers,
      byWord: fillerCounts,
      perMinute: durationMin > 0 ? totalFillers / durationMin : 0,
    },
    interruptions,
    sentimentBreakdown: sent,
  };
}

// ============================================================
// Full pipeline: transcribe + compute metrics
// ============================================================
export async function analyzeAudioFromUrl(audioUrl: string): Promise<{
  transcript: AssemblyTranscript;
  metrics: DeliveryMetrics;
  plainText: string;
}> {
  const id = await submitTranscription({
    audioUrl,
    languageCode: "pt",
    speakerLabels: true,
    sentimentAnalysis: true,
    disfluencies: true,
    autoChapters: true,
  });
  const transcript = await waitForTranscription(id);
  const metrics = computeDeliveryMetrics(transcript);

  // Build plain text with speaker + timestamps (compatible with Fireflies format)
  const plainText = (transcript.utterances ?? []).map((u) => {
    const mins = Math.floor(u.start / 60000);
    const secs = Math.floor((u.start % 60000) / 1000);
    return `[${mins}:${String(secs).padStart(2, "0")}] Speaker ${u.speaker}: ${u.text}`;
  }).join("\n");

  return { transcript, metrics, plainText };
}
