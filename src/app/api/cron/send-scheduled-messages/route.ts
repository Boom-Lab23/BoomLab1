import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Cron endpoint executado a cada minuto pelo VPS.
 * 1. Procura ScheduledMessages activas cuja scheduledFor <= agora
 * 2. Cria uma Message real no canal (ou sub-canal) correspondente
 * 3. Se recorrencia esta definida, recalcula a proxima data de envio
 * 4. Caso contrario, desactiva a ScheduledMessage
 *
 * Protegido com header x-cron-secret (env CRON_SECRET).
 */

function computeNextOccurrence(
  current: Date,
  recurrence: "daily" | "weekly" | "monthly",
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  time: string | null
): Date {
  const next = new Date(current);
  const [hh, mm] = (time ?? "09:00").split(":").map(Number);

  if (recurrence === "daily") {
    next.setDate(next.getDate() + 1);
    next.setHours(hh, mm, 0, 0);
  } else if (recurrence === "weekly") {
    // Avanca ate proximo dayOfWeek (0-6, 0=Domingo)
    const target = dayOfWeek ?? next.getDay();
    const now = new Date();
    next.setHours(hh, mm, 0, 0);
    // Comeca em amanha para garantir que nao repete hoje
    next.setDate(next.getDate() + 1);
    while (next.getDay() !== target || next <= now) {
      next.setDate(next.getDate() + 1);
    }
  } else if (recurrence === "monthly") {
    const target = dayOfMonth ?? next.getDate();
    next.setMonth(next.getMonth() + 1);
    // Clamp para dias finais (ex: 31 em Fevereiro -> ultimo dia)
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(target, maxDay));
    next.setHours(hh, mm, 0, 0);
  }

  return next;
}

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get("x-cron-secret");
    const expected = process.env.CRON_SECRET;

    if (!expected) {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
    }
    if (secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    const due = await prisma.scheduledMessage.findMany({
      where: {
        isActive: true,
        scheduledFor: { lte: now },
      },
      take: 100,
    });

    const results = {
      processed: 0,
      sent: 0,
      rescheduled: 0,
      deactivated: 0,
      errors: [] as string[],
    };

    for (const sm of due) {
      results.processed++;
      try {
        // Cria a mensagem real no canal / sub-canal
        await prisma.message.create({
          data: {
            channelId: sm.subChannelId ? null : sm.channelId,
            subChannelId: sm.subChannelId,
            authorId: sm.authorId,
            content: sm.content,
            attachments: sm.attachments ?? undefined,
          },
        });
        results.sent++;

        if (sm.recurrence && (sm.recurrence === "daily" || sm.recurrence === "weekly" || sm.recurrence === "monthly")) {
          // Recalcula proxima ocorrencia
          const nextDate = computeNextOccurrence(
            sm.scheduledFor,
            sm.recurrence,
            sm.recurrenceDayOfWeek,
            sm.recurrenceDayOfMonth,
            sm.recurrenceTime
          );
          await prisma.scheduledMessage.update({
            where: { id: sm.id },
            data: {
              lastSentAt: now,
              scheduledFor: nextDate,
            },
          });
          results.rescheduled++;
        } else {
          // One-off: desactiva
          await prisma.scheduledMessage.update({
            where: { id: sm.id },
            data: {
              isActive: false,
              lastSentAt: now,
            },
          });
          results.deactivated++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`${sm.id}: ${msg}`);
        console.error(`[cron/send-scheduled] Error processing ${sm.id}:`, err);
      }
    }

    return NextResponse.json({ success: true, ...results, timestamp: now.toISOString() });
  } catch (error) {
    console.error("[cron/send-scheduled-messages] Fatal error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

// Permitir GET tambem (Hostinger free wget/curl faz GET mais facil)
export async function GET(req: NextRequest) {
  return POST(req);
}
