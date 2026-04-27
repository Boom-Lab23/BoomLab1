import { google } from "googleapis";
import { prisma } from "@/lib/prisma";

// Create OAuth2 client
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );
}

// Get authenticated calendar client for a user
async function getCalendarClient(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account?.access_token) {
    throw new Error("Utilizador sem conta Google ligada. Faz login com Google primeiro.");
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  // Handle token refresh
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date
            ? Math.floor(tokens.expiry_date / 1000)
            : undefined,
        },
      });
    }
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  attendees: string[];
  meetLink: string | null;
  location: string | null;
  status: string;
};

// Fetch events from a user's calendar
export async function fetchCalendarEvents(
  userId: string,
  timeMin?: Date,
  timeMax?: Date
): Promise<CalendarEvent[]> {
  const calendar = await getCalendarClient(userId);

  const now = new Date();
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: (timeMin ?? new Date(now.getFullYear(), now.getMonth(), now.getDate())).toISOString(),
    timeMax: (timeMax ?? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30)).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  });

  return (res.data.items ?? []).map((event) => ({
    id: event.id ?? "",
    title: event.summary ?? "Sem titulo",
    description: event.description ?? null,
    start: new Date(event.start?.dateTime ?? event.start?.date ?? ""),
    end: new Date(event.end?.dateTime ?? event.end?.date ?? ""),
    attendees: (event.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
    meetLink: event.hangoutLink ?? null,
    location: event.location ?? null,
    status: event.status ?? "confirmed",
  }));
}

// Sync calendar events with sessions
export async function syncCalendarToSessions(userId: string): Promise<{
  synced: number;
  created: number;
  matched: number;
}> {
  const events = await fetchCalendarEvents(userId);
  let created = 0;
  let matched = 0;

  for (const event of events) {
    if (event.status === "cancelled") continue;

    // Check if session already linked to this calendar event
    const existing = await prisma.session.findFirst({
      where: { calendarEventId: event.id },
    });

    if (existing) {
      matched++;
      continue;
    }

    // Try to match with existing unlinked session on same date
    const startOfDay = new Date(event.start);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(event.start);
    endOfDay.setHours(23, 59, 59, 999);

    const matchingSession = await prisma.session.findFirst({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
        calendarEventId: null,
        title: { contains: event.title.split(" ")[0], mode: "insensitive" },
      },
    });

    if (matchingSession) {
      await prisma.session.update({
        where: { id: matchingSession.id },
        data: { calendarEventId: event.id },
      });
      matched++;
    }
    // Note: we don't auto-create sessions from calendar events
    // because we don't know which client they belong to
  }

  return { synced: events.length, created, matched };
}

// Cria um evento no Google Calendar para uma sessao
// Devolve o eventId criado (para guardar em Session.calendarEventId)
export async function createCalendarEvent(
  userId: string,
  session: {
    title: string;
    date: Date;
    description?: string | null;
    durationMinutes?: number;
    attendees?: string[];
  }
): Promise<{ eventId: string; htmlLink: string | null; meetLink: string | null }> {
  const calendar = await getCalendarClient(userId);

  const durationMin = session.durationMinutes ?? 60;
  const start = new Date(session.date);
  const end = new Date(start.getTime() + durationMin * 60_000);

  const attendeesList = (session.attendees ?? [])
    .filter((e) => e && e.includes("@"))
    .map((email) => ({ email }));

  const res = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1, // necessario para criar Meet link
    sendUpdates: attendeesList.length > 0 ? "all" : "none",
    requestBody: {
      summary: session.title,
      description: session.description ?? undefined,
      start: { dateTime: start.toISOString(), timeZone: "Europe/Lisbon" },
      end: { dateTime: end.toISOString(), timeZone: "Europe/Lisbon" },
      attendees: attendeesList.length > 0 ? attendeesList : undefined,
      conferenceData: {
        createRequest: {
          requestId: `boomlab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    },
  });

  return {
    eventId: res.data.id ?? "",
    htmlLink: res.data.htmlLink ?? null,
    meetLink: res.data.hangoutLink ?? res.data.conferenceData?.entryPoints?.[0]?.uri ?? null,
  };
}

// Pusha todas as sessoes MARCADAS que ainda nao tem calendarEventId
export async function pushPendingSessionsToCalendar(
  userId: string,
  options?: {
    onlyFuture?: boolean;
    modules?: string[];
    includeClientEmail?: boolean;
    onlyForOffboarding?: boolean;
  }
): Promise<{
  pushed: number;
  skipped: number;
  failed: number;
  errors: Array<{ sessionId: string; error: string }>;
}> {
  const where: Record<string, unknown> = {
    calendarEventId: null,
    status: "MARCADA",
  };
  if (options?.onlyFuture !== false) {
    where.date = { gte: new Date() };
  }
  if (options?.modules) {
    where.module = { in: options.modules };
  }

  const sessions = await prisma.session.findMany({
    where,
    include: { client: true },
    orderBy: { date: "asc" },
  });

  let pushed = 0, skipped = 0, failed = 0;
  const errors: Array<{ sessionId: string; error: string }> = [];

  for (const s of sessions) {
    if (!s.date) { skipped++; continue; }

    // Decide se convida cliente
    const clientEmail = s.client?.email;
    const wantInvite = options?.includeClientEmail && clientEmail;
    const isOffboarding = s.module === "off-boarding";
    const shouldInvite = options?.onlyForOffboarding
      ? (isOffboarding && wantInvite)
      : wantInvite;

    // Duracao por modulo: off-boarding 120min, restantes 60min
    const durationMinutes = isOffboarding ? 120 : 60;

    try {
      const evt = await createCalendarEvent(userId, {
        title: s.title,
        date: s.date,
        description: [
          s.client?.name ? `Cliente: ${s.client.name}` : null,
          s.module ? `Tipo: ${s.module}` : null,
          s.client?.projectEnd ? `Fim do contrato: ${s.client.projectEnd.toISOString().slice(0, 10)}` : null,
          `\nCriado automaticamente pela BoomLab Platform.`,
        ].filter(Boolean).join("\n"),
        durationMinutes,
        attendees: shouldInvite && clientEmail ? [clientEmail] : [],
      });

      await prisma.session.update({
        where: { id: s.id },
        data: {
          calendarEventId: evt.eventId,
        },
      });
      pushed++;
      // Small delay para nao bater rate limit do Google (10 QPS por user)
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      failed++;
      errors.push({ sessionId: s.id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { pushed, skipped, failed, errors };
}

// Apaga sessoes da DB e dos respectivos eventos no Google Calendar.
// Filtros: clientNames + modules + dateFrom/dateTo (ex: apagar EOMs de Abril)
export async function deleteSessionsAndCalendarEvents(
  userId: string,
  filter: {
    clientNames?: string[];
    modules?: string[];
    onlyFuture?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
  }
): Promise<{ deletedDb: number; deletedCalendar: number; errors: Array<{ sessionId: string; error: string }> }> {
  const where: Record<string, unknown> = {};
  if (filter.modules?.length) where.module = { in: filter.modules };
  if (filter.dateFrom || filter.dateTo) {
    const dateFilter: Record<string, Date> = {};
    if (filter.dateFrom) dateFilter.gte = filter.dateFrom;
    if (filter.dateTo) dateFilter.lte = filter.dateTo;
    where.date = dateFilter;
  } else if (filter.onlyFuture !== false) {
    where.date = { gte: new Date() };
  }
  if (filter.clientNames?.length) {
    where.client = { name: { in: filter.clientNames } };
  }

  const sessions = await prisma.session.findMany({
    where,
    select: { id: true, calendarEventId: true },
  });

  if (sessions.length === 0) {
    return { deletedDb: 0, deletedCalendar: 0, errors: [] };
  }

  const calendar = await getCalendarClient(userId);
  let deletedCalendar = 0;
  const errors: Array<{ sessionId: string; error: string }> = [];

  for (const s of sessions) {
    if (s.calendarEventId) {
      try {
        await calendar.events.delete({ calendarId: "primary", eventId: s.calendarEventId });
        deletedCalendar++;
        await new Promise((r) => setTimeout(r, 100));
      } catch (err) {
        // Status 410 = ja apagado, status 404 = nao encontrado: ambos sao OK
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("410") && !msg.includes("404")) {
          errors.push({ sessionId: s.id, error: msg });
        } else {
          deletedCalendar++;
        }
      }
    }
  }

  // Apagar da DB
  const result = await prisma.session.deleteMany({
    where: { id: { in: sessions.map((s) => s.id) } },
  });

  return { deletedDb: result.count, deletedCalendar, errors };
}

// Get today's events for the dashboard
export async function getTodaysEvents(userId: string): Promise<CalendarEvent[]> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  return fetchCalendarEvents(userId, startOfDay, endOfDay);
}
