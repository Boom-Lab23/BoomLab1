import { z } from "zod";
import { router, publicProcedure } from "./init";
import {
  fetchCalendarEvents,
  syncCalendarToSessions,
  getTodaysEvents,
} from "@/server/services/google-calendar";

export const calendarRouter = router({
  // Get calendar events for a date range
  events: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        from: z.date().optional(),
        to: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      return fetchCalendarEvents(input.userId, input.from, input.to);
    }),

  // Get today's events
  today: publicProcedure
    .input(z.string()) // userId
    .query(async ({ input }) => {
      return getTodaysEvents(input);
    }),

  // Sync calendar events to sessions
  sync: publicProcedure
    .input(z.string()) // userId
    .mutation(async ({ input }) => {
      return syncCalendarToSessions(input);
    }),
});
