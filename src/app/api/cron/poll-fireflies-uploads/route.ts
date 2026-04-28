import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchRecentTranscripts, fetchTranscript } from "@/server/services/fireflies";
import { generateActionPlanDraft } from "@/server/services/action-plan-workflow";
import { generatePersonalizedFeedback } from "@/server/services/feedback-engine";
import { analyzeSalesCall } from "@/server/services/sales-call-analyzer";
import { categorizeByTitle } from "@/server/services/session-categorizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cron protegido por header. Verifica uploads pendentes e processa os que
// ja tem transcricao pronta no Fireflies.
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pending = await prisma.pendingFirefliesUpload.findMany({
      where: { status: "PENDING", attempts: { lt: 60 } }, // ~1h se cron 1m
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    if (pending.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: "Sem uploads pendentes" });
    }

    // Busca transcricoes recentes do Fireflies (limit 50 cobre uploads das ultimas horas)
    const recent = await fetchRecentTranscripts(50);

    let processed = 0;
    let stillPending = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const p of pending) {
      try {
        // Match por titulo exacto (que enviamos no upload)
        const match = recent.find((t) => t.title === p.title);
        if (!match) {
          // Ainda nao transcreveu — increment attempts
          await prisma.pendingFirefliesUpload.update({
            where: { id: p.id },
            data: {
              attempts: { increment: 1 },
              lastCheckedAt: new Date(),
            },
          });
          stillPending++;
          continue;
        }

        // Encontrado! Buscar full transcript
        const transcript = await fetchTranscript(match.id);

        const sentences = transcript.sentences || [];
        const fullTranscript = sentences
          .map((s: { start_time: number; speaker_name: string; text: string }) => {
            const mins = Math.floor(s.start_time / 60);
            const secs = Math.floor(s.start_time % 60);
            return `[${mins}:${String(secs).padStart(2, "0")}] ${s.speaker_name}: ${s.text}`;
          })
          .join("\n");

        const meetingDate = (() => {
          const raw = transcript.date;
          if (!raw) return new Date();
          const asNum = Number(raw);
          if (!Number.isNaN(asNum) && asNum > 0) return new Date(asNum);
          const asDate = new Date(raw);
          return Number.isNaN(asDate.getTime()) ? new Date() : asDate;
        })();

        const firefliesUrl = `https://app.fireflies.ai/view/${match.id}`;
        const sessionNotesSummary =
          transcript.summary?.notes ||
          transcript.summary?.shorthand_bullet?.join("\n") ||
          transcript.summary?.overview ||
          null;

        const categorization = categorizeByTitle(transcript.title ?? p.title);

        // Tentar achar o consultor pelo nome
        let assignedToId: string | null = null;
        const userMatch = await prisma.user.findFirst({
          where: { name: { contains: p.commercial, mode: "insensitive" } },
        });
        if (userMatch) assignedToId = userMatch.id;

        // Cria a Session com o clientId CORRECTO (do upload pendente, nao auto-detect)
        const session = await prisma.session.create({
          data: {
            title: transcript.title ?? p.title,
            module: categorization.module ?? "Outros",
            topic: transcript.title ?? null,
            date: meetingDate,
            status: "CONCLUIDA",
            clientId: p.clientId,
            assignedToId,
            firefliesId: transcript.id,
            firefliesSummary: transcript.summary?.overview ?? null,
            firefliesNotes: fullTranscript,
            notes: sessionNotesSummary,
            firefliesRecordingUrl: firefliesUrl,
            actionItems: (transcript.summary?.action_items ?? []) as unknown as object,
          },
        });

        const recording = await prisma.recording.create({
          data: {
            title: `${session.title} - Gravacao`,
            type: "CALL",
            duration: transcript.duration ? Math.round(transcript.duration * 60) : null,
            fileUrl: transcript.video_url || transcript.audio_url || firefliesUrl,
            transcript: fullTranscript,
            clientId: p.clientId,
            sessionId: session.id,
          },
        });

        // Marcar como processado
        await prisma.pendingFirefliesUpload.update({
          where: { id: p.id },
          data: {
            status: "PROCESSED",
            firefliesId: transcript.id,
            processedAt: new Date(),
          },
        });

        // Disparar analyses async (nao bloqueia o cron)
        generateActionPlanDraft(session.id).catch((err) =>
          console.error("[poll-fireflies] action plan failed:", err)
        );
        if (assignedToId) {
          generatePersonalizedFeedback(recording.id, 0).catch((err) =>
            console.error("[poll-fireflies] feedback failed:", err)
          );
        }

        // Analise de vendas (preenche tab "Analise de Vendas" do workspace).
        // Async — corre Claude com transcript + KB filtrado por mercado.
        (async () => {
          try {
            const result = await analyzeSalesCall({
              clientId: p.clientId,
              transcript: fullTranscript,
              commercial: p.commercial,
              leadName: p.leadName ?? undefined,
              callType: p.callType,
            });
            await prisma.recording.update({
              where: { id: recording.id },
              data: {
                aiAnalysis: result as unknown as Record<string, unknown>,
                aiScore: result.overallScore,
                analyzedAt: new Date(),
              },
            });
            await prisma.salesAnalysis.create({
              data: {
                clientId: p.clientId,
                recordingId: recording.id,
                commercial: p.commercial,
                leadName: p.leadName ?? null,
                callType: p.callType,
                callDate: meetingDate,
                durationMinutes: transcript.duration ? Math.round(transcript.duration) : null,
                visibility: (p.visibility as "COMMERCIAL_ONLY" | "WHOLE_TEAM") ?? "COMMERCIAL_ONLY",
                classification: result.classification,
                overallScore: result.overallScore,
                clarezaFluidez: result.clarezaFluidez ?? null,
                tomVoz: result.tomVoz ?? null,
                expositivoConversacional: result.expositivoConversacional ?? null,
                assertividadeControlo: result.assertividadeControlo ?? null,
                empatia: result.empatia ?? null,
                passagemValor: result.passagemValor ?? null,
                respostaObjecoes: result.respostaObjecoes ?? null,
                estruturaMeet: result.estruturaMeet ?? null,
                strengths: result.strengths ?? null,
                weaknesses: result.weaknesses ?? null,
                generalTips: result.generalTips ?? null,
                focusNext: result.focusNext ?? null,
                summary: result.summary ?? null,
              },
            });
          } catch (err) {
            console.error("[poll-fireflies] sales analysis failed:", err);
          }
        })();

        processed++;
      } catch (err) {
        errors.push({ id: p.id, error: err instanceof Error ? err.message : String(err) });
        await prisma.pendingFirefliesUpload.update({
          where: { id: p.id },
          data: { attempts: { increment: 1 }, lastCheckedAt: new Date(), errorMessage: String(err) },
        });
      }
    }

    // Marcar como FAILED os que excederam tentativas
    await prisma.pendingFirefliesUpload.updateMany({
      where: { status: "PENDING", attempts: { gte: 60 } },
      data: { status: "FAILED" },
    });

    return NextResponse.json({ ok: true, processed, stillPending, errors });
  } catch (err) {
    console.error("[cron poll-fireflies] failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "poll-fireflies-uploads" });
}
