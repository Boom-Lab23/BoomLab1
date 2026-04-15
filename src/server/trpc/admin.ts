import { z } from "zod";
import { router, publicProcedure } from "./init";
import bcrypt from "bcryptjs";

export const adminRouter = router({
  // List all users
  listUsers: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        isActive: true,
        googleConnected: true,
        assignedChannelId: true,
        assignedChannel: { select: { id: true, name: true } },
        consentPrivacyPolicy: true,
        consentTerms: true,
        consentDPA: true,
        consentDataDeletion: true,
        consentAIAnalysis: true,
        consentsAcceptedAt: true,
        createdAt: true,
        _count: {
          select: { sessions: true, messages: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  // Create a new user (admin only)
  createUser: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(["ADMIN", "CONSULTANT", "MANAGER", "GUEST_CLIENT", "GUEST_TEAM_MEMBER"]).default("CONSULTANT"),
        assignedChannelId: z.string().optional(), // For GUEST roles
        assignedSubChannelIds: z.array(z.string()).optional(), // Which sub-channels they access
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new Error("Email ja registado.");
      }

      const hashedPassword = await bcrypt.hash(input.password, 12);

      // Create user
      const user = await ctx.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
          role: input.role,
          assignedChannelId: input.assignedChannelId,
        },
      });

      // If guest, add as member to the channel
      if (input.assignedChannelId && (input.role === "GUEST_CLIENT" || input.role === "GUEST_TEAM_MEMBER")) {
        const member = await ctx.prisma.channelMember.create({
          data: {
            channelId: input.assignedChannelId,
            userId: user.id,
            role: "GUEST",
          },
        });

        // Create guest permissions (read + send messages)
        await ctx.prisma.channelPermission.createMany({
          data: [
            { channelMemberId: member.id, permission: "VIEW_HISTORY", granted: true },
            { channelMemberId: member.id, permission: "SEND_MESSAGES", granted: true },
          ],
        });

        // Add to specific sub-channels if specified
        if (input.assignedSubChannelIds?.length) {
          for (const subId of input.assignedSubChannelIds) {
            await ctx.prisma.subChannelMember.create({
              data: {
                subChannelId: subId,
                userId: user.id,
                role: "GUEST",
              },
            });
          }
        }
      }

      return user;
    }),

  // Update user
  updateUser: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          email: z.string().email().optional(),
          role: z.enum(["ADMIN", "CONSULTANT", "MANAGER", "GUEST_CLIENT", "GUEST_TEAM_MEMBER"]).optional(),
          isActive: z.boolean().optional(),
          assignedChannelId: z.string().nullable().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.id },
        data: input.data as Record<string, unknown>,
      });
    }),

  // Reset password
  resetPassword: publicProcedure
    .input(z.object({ userId: z.string(), newPassword: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      const hashedPassword = await bcrypt.hash(input.newPassword, 12);
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { password: hashedPassword },
      });
    }),

  deactivateUser: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.user.update({ where: { id: input }, data: { isActive: false } });
  }),

  activateUser: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.user.update({ where: { id: input }, data: { isActive: true } });
  }),
});
