import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/server/services/email";

/**
 * Endpoint para alertas internos (scripts bash de backup, monitoring).
 *
 * Protegido com header x-cron-secret para que so o VPS local possa chamar.
 *
 * POST /api/admin/alert
 * Body: { subject: string, body: string, to?: string }
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { subject, body, to } = (await req.json()) as { subject: string; body: string; to?: string };
    if (!subject || !body) {
      return NextResponse.json({ error: "missing subject or body" }, { status: 400 });
    }

    await sendEmail({
      to: to || process.env.BACKUP_ALERT_EMAIL || "guilherme@boomlab.agency",
      subject: `🚨 BoomLab: ${subject}`,
      html: `<h2>🚨 ${subject}</h2><pre style="background:#f5f5f5;padding:12px;border-radius:6px;white-space:pre-wrap;font-family:monospace;">${body.replace(/</g, "&lt;")}</pre><p style="color:#666;font-size:12px;">Timestamp: ${new Date().toISOString()} · Host: ${req.headers.get("host")}</p>`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/alert] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "failed" },
      { status: 500 }
    );
  }
}
