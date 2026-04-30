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
import { timelinesRouter } from "./timelines";
import { referralsRouter } from "./referrals";
import { dashboardsRouter } from "./dashboards";
import { leadsRouter } from "./leads";
import { salesAnalysisRouter } from "./salesAnalysis";
import { scheduledMessagesRouter } from "./scheduled-messages";
import { trackerRouter } from "./tracker";
import { ghlRouter } from "./ghl";
import { clientCommercialsRouter } from "./clientCommercials";

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
  timelines: timelinesRouter,
  referrals: referralsRouter,
  dashboards: dashboardsRouter,
  leads: leadsRouter,
  salesAnalysis: salesAnalysisRouter,
  scheduledMessages: scheduledMessagesRouter,
  tracker: trackerRouter,
  ghl: ghlRouter,
  clientCommercials: clientCommercialsRouter,
});

export type AppRouter = typeof appRouter;
