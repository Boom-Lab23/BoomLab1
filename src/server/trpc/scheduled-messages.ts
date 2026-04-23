import { z } from "zod";
import { router, publicProcedure } from "./init";

/**
 * Scheduled Messages router.
 * Allows users to schedule a message to be sent later, optionally recurring
 * (daily, weekly, monthly). The actual sending is done by a cron endpoint
 * (/api/cron/send-scheduled-messages) that runs every minute on the VPS.
 */
export const scheduledMessagesRouter = router({
  // List upcoming scheduled messages
  list: publicProcedure
    .input(
      z.object({
        channelId: z.string().optional(),
        authorId: z.string().optional(),
        onlyActive: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.channelId) where.channelId = input.channelId;
      if (input.authorId) where.authorId = input.authorId;
      if (input.onlyActive) where.isActive = true;

      return ctx.prisma.scheduledMessage.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, email: true, image: true } },
        },
        orderBy: { scheduledFor: "asc" },
      });
    }),

  // Create a new scheduled message
  create: publicProcedure
    .input(
      z.object({
        channelId: z.string(),
        subChannelId: z.string().optional(),
        authorId: z.string(),
        content: z.string().min(1),
        attachments: z.any().optional(),
        scheduledFor: z.date(),
        recurrence: z.enum(["daily", "weekly", "monthly"]).optional(),
        recurrenceDayOfWeek: z.number().min(0).max(6).optional(),
        recurrenceDayOfMonth: z.number().min(1).max(31).optional(),
        recurrenceTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.scheduledMessage.create({
        data: {
          channelId: input.channelId,
          subChannelId: input.subChannelId ?? null,
          authorId: input.authorId,
          content: input.content,
          attachments: input.attachments ?? undefined,
          scheduledFor: input.scheduledFor,
          recurrence: input.recurrence ?? null,
          recurrenceDayOfWeek: input.recurrenceDayOfWeek ?? null,
          recurrenceDayOfMonth: input.recurrenceDayOfMonth ?? null,
          recurrenceTime: input.recurrenceTime ?? null,
          isActive: true,
        },
      });
    }),

  // Update an existing scheduled message
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string().optional(),
        scheduledFor: z.date().optional(),
        recurrence: z.enum(["daily", "weekly", "monthly"]).nullable().optional(),
        recurrenceDayOfWeek: z.number().min(0).max(6).nullable().optional(),
        recurrenceDayOfMonth: z.number().min(1).max(31).nullable().optional(),
        recurrenceTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.scheduledMessage.update({
        where: { id },
        data,
      });
    }),

  // Cancel (soft-delete) a scheduled message
  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.scheduledMessage.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  // Hard delete
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.scheduledMessage.delete({
        where: { id: input.id },
      });
    }),
});
