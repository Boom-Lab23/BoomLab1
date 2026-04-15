import { z } from "zod";
import { router, publicProcedure } from "./init";

export const referralsRouter = router({
  // List referrals
  list: publicProcedure
    .input(z.object({
      clientId: z.string().optional(),
      status: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input?.clientId) where.referrerClientId = input.clientId;
      if (input?.status) where.status = input.status;

      return ctx.prisma.referral.findMany({
        where,
        include: { referrerClient: true },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Stats
  stats: publicProcedure.query(async ({ ctx }) => {
    const [total, pending, converted, lost] = await Promise.all([
      ctx.prisma.referral.count(),
      ctx.prisma.referral.count({ where: { status: { in: ["PENDING", "CONTACTED", "MEETING_SCHEDULED", "PROPOSAL_SENT"] } } }),
      ctx.prisma.referral.count({ where: { status: "CONVERTED" } }),
      ctx.prisma.referral.count({ where: { status: "LOST" } }),
    ]);

    // Count referrals per client
    const byClient = await ctx.prisma.referral.groupBy({
      by: ["referrerClientId"],
      _count: true,
      orderBy: { _count: { referrerClientId: "desc" } },
    });

    return { total, pending, converted, lost, byClient };
  }),

  // Create referral
  create: publicProcedure
    .input(z.object({
      referrerClientId: z.string(),
      referredName: z.string().min(1),
      referredEmail: z.string().optional(),
      referredPhone: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.referral.create({ data: input });
    }),

  // Update status
  updateStatus: publicProcedure
    .input(z.object({
      id: z.string(),
      status: z.enum(["PENDING", "CONTACTED", "MEETING_SCHEDULED", "PROPOSAL_SENT", "CONVERTED", "LOST"]),
      convertedToClientId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.referral.update({
        where: { id: input.id },
        data: {
          status: input.status,
          convertedToClientId: input.convertedToClientId,
        },
      });
    }),

  // Delete
  delete: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.referral.delete({ where: { id: input } });
  }),
});
