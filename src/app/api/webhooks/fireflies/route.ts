import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchTranscript } from "@/server/services/fireflies";
import { generateActionPlanDraft } from "@/server/services/action-plan-workflow";
import { generatePersonalizedFeedback } from "@/server/services/feedback-engine";
import { categorizeByTitle } from "@/server/services/session-categorizer";

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

    // Idempotency: if we already processed this transcript, skip
    const alreadyLinked = await prisma.session.findUnique({ where: { firefliesId: transcriptId } });
    if (alreadyLinked) {
      return NextResponse.json({ success: true, alreadyProcessed: true, sessionId: alreadyLinked.id });
    }

    // 1. Fetch full transcript from Fireflies
    const transcript = await fetchTranscript(transcriptId);
    // Fireflies date can be ISO string OR numeric ms as string. Handle both.
    const meetingDate = (() => {
      const raw = transcript.date;
      if (!raw) return new Date();
      const asNum = Number(raw);
      if (!Number.isNaN(asNum) && asNum > 0) return new Date(asNum);
      const asDate = new Date(raw);
      return Number.isNaN(asDate.getTime()) ? new Date() : asDate;
    })();

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
    const sessionNotesSummary = transcript.summary?.notes
      || transcript.summary?.shorthand_bullet?.join("\n")
      || transcript.summary?.overview
      || null;

    // 4. Try to match with existing session (widen window to +/- 24h, not just same day)
    const windowStart = new Date(meetingDate.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd = new Date(meetingDate.getTime() + 24 * 60 * 60 * 1000);

    let session = await prisma.session.findFirst({
      where: {
        date: { gte: windowStart, lte: windowEnd },
        firefliesId: null,
      },
      orderBy: {
        // prefer same-day, non-completed
        date: "asc",
      },
      include: { client: true },
    });

    // 5. If no matching session exists, CREATE ONE AUTOMATICALLY.
    //    - Try to detect client from participant emails (matching client.email or existing user emails)
    //    - Otherwise fall back to a "Unassigned" client (created on the fly)
    let autoCreated = false;
    if (!session) {
      // Auto-categorize pillar/module from the meeting title
      const categorization = categorizeByTitle(transcript.title ?? "Reuniao");

      // Try to find a client based on meeting participants
      const participants: string[] = Array.isArray(transcript.participants) ? transcript.participants : [];
      let clientId: string | null = null;

      if (participants.length > 0) {
        // Match by client email
        const emailMatch = await prisma.client.findFirst({
          where: { email: { in: participants } },
        });
        if (emailMatch) {
          clientId = emailMatch.id;
        } else {
          // Extract domain (e.g. @belocredito.pt) and try to match by name similarity
          const externalDomains = participants
            .map((p) => p.split("@")[1])
            .filter((d): d is string => !!d && !/(gmail|hotmail|outlook|boomlab)\.(com|pt|agency)/i.test(d));
          for (const domain of externalDomains) {
            const nameGuess = domain.split(".")[0];
            const nameMatch = await prisma.client.findFirst({
              where: { name: { contains: nameGuess, mode: "insensitive" } },
            });
            if (nameMatch) { clientId = nameMatch.id; break; }
          }
        }
      }

      // Fallback: use/create a catch-all "Reunioes Soltas" client
      if (!clientId) {
        const catchAll = await prisma.client.upsert({
          where: { id: "__catchall_meetings__" },
          update: {},
          create: {
            id: "__catchall_meetings__",
            name: "Reunioes por classificar",
            status: "ATIVO",
          },
        });
        clientId = catchAll.id;
      }

      // Find assignee: first participant that matches a User by email
      let assignedToId: string | null = null;
      if (participants.length > 0) {
        const userMatch = await prisma.user.findFirst({
          where: { email: { in: participants } },
        });
        if (userMatch) assignedToId = userMatch.id;
      }

      session = await prisma.session.create({
        data: {
          title: transcript.title ?? "Reuniao",
          module: categorization.module ?? "Outros",
          topic: transcript.title ?? null,
          date: meetingDate,
          status: "CONCLUIDA",
          clientId,
          assignedToId,
          firefliesId: transcript.id,
          firefliesSummary: transcript.summary?.overview ?? null,
          firefliesNotes: fullTranscript,
          notes: sessionNotesSummary,
          firefliesRecordingUrl: firefliesUrl,
          actionItems: (transcript.summary?.action_items ?? []) as unknown as object,
        },
        include: { client: true },
      });
      autoCreated = true;
    } else {
      // 6. Update the existing session with Fireflies data
      session = await prisma.session.update({
        where: { id: session.id },
        data: {
          firefliesId: transcript.id,
          firefliesSummary: transcript.summary?.overview ?? null,
          firefliesNotes: fullTranscript,
          notes: sessionNotesSummary,
          firefliesRecordingUrl: firefliesUrl,
          actionItems: (transcript.summary?.action_items ?? []) as unknown as object,
          status: "CONCLUIDA",
        },
        include: { client: true },
      });
    }

    // 7. Create/link recording entry
    const recording = await prisma.recording.create({
      data: {
        title: `${session.title} - Gravacao`,
        type: "MEETING",
        duration: transcript.duration ? Math.round(transcript.duration * 60) : null,
        fileUrl: transcript.video_url || transcript.audio_url || firefliesUrl,
        transcript: fullTranscript,
        clientId: session.clientId,
        sessionId: session.id,
      },
    });

    // 8. Trigger async downstream tasks (non-blocking)
    generateActionPlanDraft(session.id).catch((err) => console.error("Action plan draft failed:", err));
    if (session.assignedToId) {
      generatePersonalizedFeedback(recording.id, 4).catch((err) => console.error("Feedback generation failed:", err));
    }

    return NextResponse.json({
      success: true,
      matched: !autoCreated,
      autoCreated,
      sessionId: session.id,
      clientName: session.client.name,
      firefliesUrl,
    });
  } catch (error) {
    console.error("Fireflies webhook error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Also allow GET -> health check (so Fireflies can verify the URL)
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "fireflies-webhook" });
}
