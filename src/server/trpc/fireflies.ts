import { z } from "zod";
import { router, publicProcedure } from "./init";
import {
  fetchRecentTranscripts,
  linkTranscriptToSession,
  syncFireflies,
} from "@/server/services/fireflies";
import { autoAnalyzeMeeting } from "@/server/services/meeting-analyzer";

export const firefliesRouter = router({
  // Fetch recent transcripts from Fireflies
  recentTranscripts: publicProcedure.query(async () => {
    return fetchRecentTranscripts(20);
  }),

  // Link a transcript to a session
  linkToSession: publicProcedure
    .input(
      z.object({
        transcriptId: z.string(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      await linkTranscriptToSession(input.transcriptId, input.sessionId);
      return { success: true };
    }),

  // Auto-sync recent transcripts
  sync: publicProcedure.mutation(async () => {
    return syncFireflies();
  }),

  // Analyze a meeting with AI (generates summary + action plan + sends to Slack)
  analyzeMeeting: publicProcedure
    .input(z.string()) // sessionId
    .mutation(async ({ input }) => {
      return autoAnalyzeMeeting(input);
    }),
});
