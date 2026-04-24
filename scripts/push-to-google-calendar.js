/**
 * Pusha todas as 114 sessoes MARCADAS (EOM + Off-Boarding) para o Google Calendar
 * do admin guilherme@boomlab.agency.
 *
 * Pre-requisitos:
 * - User tem que ter ligado Google em /settings (googleConnected=true + access_token)
 * - OAuth scopes incluem calendar.events
 *
 * Corre: docker exec -u root boomlab-app node /app/push-to-google-calendar.js
 *
 * NAO convida clientes por email (config do user). So cria eventos no proprio calendario
 * do admin com Google Meet link automatico.
 */

const { PrismaClient } = require("@prisma/client");
const { google } = require("googleapis");

const prisma = new PrismaClient();

const ADMIN_EMAIL = "guilherme@boomlab.agency";

async function getCalendarClient(userId) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });
  if (!account?.access_token) {
    throw new Error("Sem access_token. Liga o Google em /settings primeiro.");
  }
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );
  oauth2.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });
  // Auto-save refreshed tokens
  oauth2.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        },
      });
    }
  });
  return google.calendar({ version: "v3", auth: oauth2 });
}

async function main() {
  const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    console.error(`Admin ${ADMIN_EMAIL} nao encontrado`);
    process.exit(1);
  }
  if (!admin.googleConnected) {
    console.error(`${ADMIN_EMAIL} ainda nao ligou Google. Vai a /settings primeiro.`);
    process.exit(1);
  }

  const calendar = await getCalendarClient(admin.id);

  // Sessoes a pushar
  const sessions = await prisma.session.findMany({
    where: {
      module: { in: ["off-boarding", "end-of-month"] },
      date: { gte: new Date() },
      calendarEventId: null,
    },
    include: { client: true },
    orderBy: { date: "asc" },
  });

  console.log(`[push] ${sessions.length} sessoes a criar no Google Calendar`);

  let pushed = 0;
  let failed = 0;
  const errors = [];

  for (const s of sessions) {
    const start = new Date(s.date);
    const end = new Date(start.getTime() + 60 * 60_000); // 60min

    const description = [
      s.client?.name ? `Cliente: ${s.client.name}` : null,
      s.module === "off-boarding" ? `Tipo: Off-Boarding` : `Tipo: End-of-Month`,
      s.client?.projectEnd ? `Fim do contrato: ${s.client.projectEnd.toISOString().slice(0, 10)}` : null,
      s.client?.ceo ? `CEO: ${s.client.ceo}` : null,
      "",
      "Criado automaticamente pela BoomLab Platform.",
      `https://servico.boomlab.cloud/clients/${s.client?.id ?? ""}`,
    ].filter(Boolean).join("\n");

    try {
      const res = await calendar.events.insert({
        calendarId: "primary",
        conferenceDataVersion: 1,
        sendUpdates: "none", // Sem convidar clientes (config do user)
        requestBody: {
          summary: s.title,
          description,
          start: { dateTime: start.toISOString(), timeZone: "Europe/Lisbon" },
          end: { dateTime: end.toISOString(), timeZone: "Europe/Lisbon" },
          conferenceData: {
            createRequest: {
              requestId: `boomlab-${s.id}-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "email", minutes: 24 * 60 },
              { method: "popup", minutes: 15 },
            ],
          },
          colorId: s.module === "off-boarding" ? "11" : "5", // vermelho vs amarelo
        },
      });

      const eventId = res.data.id ?? "";
      const meetLink = res.data.hangoutLink ?? res.data.conferenceData?.entryPoints?.[0]?.uri ?? null;

      await prisma.session.update({
        where: { id: s.id },
        data: { calendarEventId: eventId, meetLink: meetLink ?? undefined },
      });

      pushed++;
      if (pushed % 10 === 0) console.log(`[push] ${pushed}/${sessions.length}...`);

      // Rate limit Google: 10 QPS por user. 120ms = ~8 QPS seguro
      await new Promise((r) => setTimeout(r, 120));
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ session: s.title, date: s.date.toISOString().slice(0, 16), error: msg });
      console.error(`[fail] ${s.title}: ${msg.slice(0, 100)}`);

      // Se der erro de autenticacao, parar
      if (msg.includes("invalid_grant") || msg.includes("401")) {
        console.error("\n[ABORT] Token invalido. Refaz login em /settings.");
        break;
      }
    }
  }

  console.log(`\n[push] RESULTADO: ${pushed} criadas, ${failed} falharam`);
  if (errors.length > 0) {
    console.log("\nErros:");
    errors.slice(0, 10).forEach((e) => console.log(`  - ${e.session} (${e.date}): ${e.error.slice(0, 80)}`));
    if (errors.length > 10) console.log(`  ...e mais ${errors.length - 10} erros`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
