import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchTranscript } from "@/server/services/fireflies";
import { generateActionPlanDraft } from "@/server/services/action-plan-workflow";
import { generatePersonalizedFeedback } from "@/server/services/feedback-engine";

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

    // 1. Fetch full transcript from Fireflies
    const transcript = await fetchTranscript(transcriptId);
    const meetingDate = new Date(transcript.date);
    const startOfDay = new Date(meetingDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(meetingDate);
    endOfDay.setHours(23, 59, 59, 999);

    // 2. Format full transcript
    const sentences = transcript.sentences || [];
    const fullTranscript = sentences
      .map((s: { start_time: number; speaker_name: string; text: string }) => {
        const mins = Math.floor(s.start_time / 60);
        const secs = Math.floor(s.start_time % 60);
        return `[${mins}:${String(secs).padStart(2, "0")}] ${s.speaker_name}: ${s.text}`;
      })
      .join("\n");

    // 3. Build Fireflies recording URL
    const firefliesUrl = `https://app.fireflies.ai/view/${transcriptId}`;

    // 4. Try to match with existing session
    const matchingSession = await prisma.session.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        firefliesId: null,
      },
      include: { client: true },
    });

    if (matchingSession) {
      // 5. Save Fireflies data + recording URL organized by client
      await prisma.session.update({
        where: { id: matchingSession.id },
        data: {
          firefliesId: transcript.id,
          firefliesSummary: transcript.summary?.overview ?? null,
          firefliesNotes: fullTranscript,
          firefliesRecordingUrl: firefliesUrl,
          actionItems: transcript.summary?.action_items ?? [],
          status: "CONCLUIDA",
        },
      });

      // 6. Generate action plan as DRAFT (admin reviews before sending)
      generateActionPlanDraft(matchingSession.id).catch((err) =>
        console.error("Action plan draft failed:", err)
      );

      // 7. Generate personalized feedback with 4h delay
      if (matchingSession.assignedToId) {
        // Create a recording entry linked to the session
        const recording = await prisma.recording.create({
          data: {
            title: `${matchingSession.title} - Gravacao`,
            type: "MEETING",
            fileUrl: firefliesUrl,
            transcript: fullTranscript,
            clientId: matchingSession.clientId,
            sessionId: matchingSession.id,
          },
        });

        generatePersonalizedFeedback(recording.id, 4).catch((err) =>
          console.error("Feedback generation failed:", err)
        );
      }

      return NextResponse.json({
        success: true,
        matched: true,
        sessionId: matchingSession.id,
        clientName: matchingSession.client.name,
        firefliesUrl,
        actionPlan: "draft_created",
        feedback: "scheduled_4h_delay",
      });
    }

    return NextResponse.json({
      success: true,
      matched: false,
      transcriptId: transcript.id,
      title: transcript.title,
      firefliesUrl,
    });
  } catch (error) {
    console.error("Fireflies webhook error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
