import { z } from "zod";
import { router, publicProcedure } from "./init";
import {
  fetchCalendarEvents,
  syncCalendarToSessions,
  getTodaysEvents,
} from "@/server/services/google-calendar";

export const calendarRouter = router({
  // Get calendar events for a single user
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

  // Get calendar events for multiple users (with member info)
  teamEvents: publicProcedure
    .input(
      z.object({
        userIds: z.array(z.string()),
        from: z.date().optional(),
        to: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const results: {
        userId: string;
        userName: string;
        events: Awaited<ReturnType<typeof fetchCalendarEvents>>;
      }[] = [];

      for (const userId of input.userIds) {
        try {
          const user = await ctx.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          });
          const events = await fetchCalendarEvents(userId, input.from, input.to);
          results.push({
            userId,
            userName: user?.name ?? "Desconhecido",
            events,
          });
        } catch {
          // Skip users whose Google is not connected or expired
        }
      }

      return results;
    }),

  // Get today's events
  today: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      return getTodaysEvents(input);
    }),

  // Sync calendar events to sessions
  sync: publicProcedure
    .input(z.string())
    .mutation(async ({ input }) => {
      return syncCalendarToSessions(input);
    }),
});
