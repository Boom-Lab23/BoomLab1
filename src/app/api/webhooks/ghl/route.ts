import { NextRequest, NextResponse } from "next/server";
import { processGhlWebhook, type GhlWebhookPayload } from "@/server/services/ghl-intake";

/**
 * Webhook endpoint for GoHighLevel.
 *
 * Configura no GHL:
 *   Settings > Workflows > Actions > Webhook > Method: POST
 *   URL: https://servico.boomlab.cloud/api/webhooks/ghl
 *   Header: X-Webhook-Secret: <GHL_WEBHOOK_SECRET env>
 *
 * Dispara quando Opportunity.status = "won" na pipeline principal.
 * Idempotente: se o mesmo dealId ja foi processado, nao duplica.
 */

export async function POST(req: NextRequest) {
  try {
    // Protecao: header partilhado com o workflow GHL
    const expected = process.env.GHL_WEBHOOK_SECRET;
    if (expected) {
      const got = req.headers.get("x-webhook-secret") ?? req.headers.get("X-Webhook-Secret");
      if (got !== expected) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const payload = (await req.json()) as GhlWebhookPayload;
    console.log("[webhook/ghl] received", JSON.stringify(payload).slice(0, 500));

    const result = await processGhlWebhook(payload);
    const httpStatus = result.status === "failed" ? 500 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[webhook/ghl] fatal:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Alguns testes/preview enviam GET - devolvemos info basica
export async function GET() {
  return NextResponse.json({
    service: "GoHighLevel webhook",
    expecting: "POST with opportunity payload",
    secretRequired: !!process.env.GHL_WEBHOOK_SECRET,
  });
}
