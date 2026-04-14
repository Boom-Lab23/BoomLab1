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

// Get today's events for the dashboard
export async function getTodaysEvents(userId: string): Promise<CalendarEvent[]> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  return fetchCalendarEvents(userId, startOfDay, endOfDay);
}
