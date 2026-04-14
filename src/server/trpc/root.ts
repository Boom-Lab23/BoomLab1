import { router } from "./init";
import { clientsRouter } from "./clients";
import { sessionsRouter } from "./sessions";
import { recordingsRouter } from "./recordings";
import { firefliesRouter } from "./fireflies";
import { slackRouter } from "./slack";
import { messagingRouter } from "./messaging";
import { calendarRouter } from "./calendar";
import { documentsRouter } from "./documents";

export const appRouter = router({
  clients: clientsRouter,
  sessions: sessionsRouter,
  recordings: recordingsRouter,
  fireflies: firefliesRouter,
  slack: slackRouter,
  messaging: messagingRouter,
  calendar: calendarRouter,
  documents: documentsRouter,
});

export type AppRouter = typeof appRouter;
