import { router } from "./init";
import { clientsRouter } from "./clients";
import { sessionsRouter } from "./sessions";
import { recordingsRouter } from "./recordings";
import { firefliesRouter } from "./fireflies";
import { slackRouter } from "./slack";
import { messagingRouter } from "./messaging";
import { calendarRouter } from "./calendar";
import { documentsRouter } from "./documents";
import { adminRouter } from "./admin";
import { feedbackRouter } from "./feedback";
import { knowledgeRouter } from "./knowledge";

export const appRouter = router({
  clients: clientsRouter,
  sessions: sessionsRouter,
  recordings: recordingsRouter,
  fireflies: firefliesRouter,
  slack: slackRouter,
  messaging: messagingRouter,
  calendar: calendarRouter,
  documents: documentsRouter,
  admin: adminRouter,
  feedback: feedbackRouter,
  knowledge: knowledgeRouter,
});

export type AppRouter = typeof appRouter;
