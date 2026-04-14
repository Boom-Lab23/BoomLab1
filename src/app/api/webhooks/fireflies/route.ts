import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchTranscript } from "@/server/services/fireflies";
import { onMeetingCompleted } from "@/server/services/meeting-analyzer";

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-webhook-secret");
    if (process.env.FIREFLIES_WEBHOOK_SECRET && secret !== process.env.FIREFLIES_WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const transcriptId = payload.meetingId || payload.transcript_id || payload.id;

    if (!transcriptId) {
      return NextResponse.json({ error: "No transcript ID" }, { status: 400 });
    }

    // Fetch full transcript from Fireflies API
    const transcript = await fetchTranscript(transcriptId);
    const meetingDate = new Date(transcript.date);
    const startOfDay = new Date(meetingDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(meetingDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Try to match with an existing session
    const matchingSession = await prisma.session.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        firefliesId: null,
      },
      include: { client: true },
    });

    const sentences = transcript.sentences || [];
    const fullTranscript = sentences
      .map((s: { start_time: number; speaker_name: string; text: string }) => {
        const mins = Math.floor(s.start_time / 60);
        const secs = Math.floor(s.start_time % 60);
        return `[${mins}:${String(secs).padStart(2, "0")}] ${s.speaker_name}: ${s.text}`;
      })
      .join("\n");

    if (matchingSession) {
      // Save Fireflies data
      await prisma.session.update({
        where: { id: matchingSession.id },
        data: {
          firefliesId: transcript.id,
          firefliesSummary: transcript.summary?.overview ?? null,
          firefliesNotes: fullTranscript,
          actionItems: transcript.summary?.action_items ?? [],
          status: "CONCLUIDA",
        },
      });

      // AUTO-ANALYZE: trigger IA analysis + Slack notification
      // Run in background (don't block the webhook response)
      onMeetingCompleted(matchingSession.id).catch((err) =>
        console.error("Auto-analysis failed:", err)
      );

      return NextResponse.json({
        success: true,
        matched: true,
        sessionId: matchingSession.id,
        clientName: matchingSession.client.name,
        autoAnalysis: "triggered",
      });
    }

    return NextResponse.json({
      success: true,
      matched: false,
      transcriptId: transcript.id,
      title: transcript.title,
    });
  } catch (error) {
    console.error("Fireflies webhook error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
