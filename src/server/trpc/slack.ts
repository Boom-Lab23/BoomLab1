import { z } from "zod";
import { router, publicProcedure } from "./init";
import { sendActionPlanToSlack, listSlackChannels } from "@/server/services/slack";

export const slackRouter = router({
  // List available Slack channels
  channels: publicProcedure.query(async () => {
    try {
      return await listSlackChannels();
    } catch {
      return [];
    }
  }),

  // Send action plan to Slack
  sendActionPlan: publicProcedure
    .input(z.string()) // sessionId
    .mutation(async ({ input }) => {
      await sendActionPlanToSlack(input);
      return { success: true };
    }),

  // Configure Slack channel for a client
  setClientChannel: publicProcedure
    .input(
      z.object({
        clientId: z.string(),
        slackChannelId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.client.update({
        where: { id: input.clientId },
        data: { slackChannelId: input.slackChannelId },
      });
    }),
});
