import { z } from "zod";
import { router, publicProcedure } from "./init";
import { publishFeedback, autoPublishReviewedFeedbacks } from "@/server/services/feedback-engine";

export const feedbackRouter = router({
  // Get feedbacks pending admin review
  pendingReview: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.feedback.findMany({
      where: { status: "PENDING_REVIEW" },
      include: {
        user: true,
        session: { include: { client: true } },
        recording: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Get feedbacks for a specific user (only published ones)
  forUser: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      return ctx.prisma.feedback.findMany({
        where: { userId: input, status: "PUBLISHED" },
        include: {
          session: { include: { client: true } },
          recording: true,
        },
        orderBy: { publishedAt: "desc" },
      });
    }),

  // Admin: approve feedback (mark as reviewed, will publish after delay)
  approve: publicProcedure
    .input(z.object({
      feedbackId: z.string(),
      content: z.string().optional(), // Allow editing before approval
    }))
    .mutation(async ({ ctx, input }) => {
      const data: Record<string, unknown> = {
        status: "REVIEWED",
        reviewedAt: new Date(),
      };
      if (input.content) data.content = input.content;

      return ctx.prisma.feedback.update({
        where: { id: input.feedbackId },
        data,
      });
    }),

  // Admin: reject feedback
  reject: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.feedback.update({
        where: { id: input },
        data: { status: "REJECTED", reviewedAt: new Date() },
      });
    }),

  // Force publish now
  publishNow: publicProcedure
    .input(z.string())
    .mutation(async ({ input }) => {
      await publishFeedback(input);
      return { success: true };
    }),

  // Auto-publish reviewed feedbacks past their delay
  autoPublish: publicProcedure.mutation(async () => {
    const count = await autoPublishReviewedFeedbacks();
    return { published: count };
  }),
});
