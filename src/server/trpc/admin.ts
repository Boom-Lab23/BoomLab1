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
        role: z.enum(["ADMIN", "CONSULTANT", "MANAGER"]).default("CONSULTANT"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if email already exists
      const existing = await ctx.prisma.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new Error("Email ja registado.");
      }

      const hashedPassword = await bcrypt.hash(input.password, 12);

      return ctx.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          password: hashedPassword,
          role: input.role,
        },
      });
    }),

  // Update user
  updateUser: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
          email: z.string().email().optional(),
          role: z.enum(["ADMIN", "CONSULTANT", "MANAGER"]).optional(),
          isActive: z.boolean().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input.id },
        data: input.data,
      });
    }),

  // Reset password
  resetPassword: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const hashedPassword = await bcrypt.hash(input.newPassword, 12);
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { password: hashedPassword },
      });
    }),

  // Deactivate user
  deactivateUser: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input },
        data: { isActive: false },
      });
    }),

  // Reactivate user
  activateUser: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { id: input },
        data: { isActive: true },
      });
    }),
});
