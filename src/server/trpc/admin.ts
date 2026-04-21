import { z } from "zod";
import { router, publicProcedure } from "./init";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail, sendPasswordResetEmail, generateTempPassword } from "../services/email";

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
        assignedDashboardId: true,
        assignedDashboard: { select: { id: true, client: { select: { name: true } }, market: true } },
        assignedWorkspaceClientId: true,
        assignedWorkspaceClient: { select: { id: true, name: true } },
        consentPrivacyPolicy: true,
        consentTerms: true,
        consentDPA: true,
        consentDataDeletion: true,
        consentAIAnalysis: true,
        consentsAcceptedAt: true,
        mustChangePassword: true,
        welcomeEmailSentAt: true,
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
        password: z.string().min(6).optional(),
        role: z.enum(["ADMIN", "CONSULTANT", "MANAGER", "GUEST_CLIENT", "GUEST_TEAM_MEMBER"]).default("CONSULTANT"),
        assignedChannelId: z.string().optional(),
        assignedDashboardId: z.string().optional(),
        assignedWorkspaceClientId: z.string().optional(),
        assignedSubChannelIds: z.array(z.string()).optional(),
        sendWelcomeEmail: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Normalize email - always lowercase + trim
      const normalizedEmail = input.email.trim().toLowerCase();

      // Case-insensitive lookup to detect duplicates
      const existing = await ctx.prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      });
      if (existing) {
        throw new Error("Email ja registado.");
      }

      // Use provided password or generate a temporary one
      const plainPassword = input.password || generateTempPassword();
      const hashedPassword = await bcrypt.hash(plainPassword, 12);

      // Non-guests nao tem acessos restritos - ignora os campos assigned* se nao for guest
      const isGuestRole = input.role === "GUEST_CLIENT" || input.role === "GUEST_TEAM_MEMBER";

      // Create user
      const user = await ctx.prisma.user.create({
        data: {
          name: input.name,
          email: normalizedEmail,
          password: hashedPassword,
          role: input.role,
          isActive: true,
          assignedChannelId: isGuestRole ? input.assignedChannelId : null,
          assignedDashboardId: isGuestRole ? input.assignedDashboardId : null,
          assignedWorkspaceClientId: isGuestRole ? input.assignedWorkspaceClientId : null,
          mustChangePassword: input.sendWelcomeEmail,
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

      // Send welcome email
      let emailResult: { success: boolean; error?: string } = { success: false };
      if (input.sendWelcomeEmail) {
        // Fetch client name if guest
        let clientName: string | undefined;
        if (input.assignedChannelId) {
          const channel = await ctx.prisma.channel.findUnique({
            where: { id: input.assignedChannelId },
            select: { client: { select: { name: true } } },
          });
          clientName = channel?.client?.name;
        }

        emailResult = await sendWelcomeEmail({
          name: user.name,
          email: user.email,
          password: plainPassword,
          role: user.role,
          clientName,
        });

        if (emailResult.success) {
          await ctx.prisma.user.update({
            where: { id: user.id },
            data: { welcomeEmailSentAt: new Date() },
          });
        }
      }

      return {
        user,
        emailSent: emailResult.success,
        emailError: emailResult.error,
        generatedPassword: !input.password ? plainPassword : undefined,
      };
    }),

  // Resend welcome email (generates new temp password)
  resendWelcomeEmail: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        include: {
          assignedChannel: { include: { client: { select: { name: true } } } },
        },
      });
      if (!user) throw new Error("Utilizador nao encontrado.");

      const newPassword = generateTempPassword();
      const hashed = await bcrypt.hash(newPassword, 12);

      // Normalize email to lowercase when updating (fix case-sensitivity)
      const normalizedEmail = user.email.trim().toLowerCase();
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: {
          email: normalizedEmail,
          password: hashed,
          mustChangePassword: true,
          isActive: true,
        },
      });

      const result = await sendWelcomeEmail({
        name: user.name,
        email: normalizedEmail,
        password: newPassword,
        role: user.role,
        clientName: user.assignedChannel?.client?.name,
      });

      if (result.success) {
        await ctx.prisma.user.update({
          where: { id: user.id },
          data: { welcomeEmailSentAt: new Date() },
        });
      }

      // Devolve a password ao admin para poder verificar
      return { success: result.success, error: result.error, newPassword, email: normalizedEmail };
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
          assignedWorkspaceClientId: z.string().nullable().optional(),
          assignedDashboardId: z.string().nullable().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const patch = { ...input.data } as Record<string, unknown>;

      // Se a role esta a ser mudada para NON-GUEST (ADMIN/CONSULTANT/MANAGER),
      // limpa os campos de acessos restritos. Non-guests nao tem workspace/canal limitado.
      if (
        input.data.role &&
        input.data.role !== "GUEST_CLIENT" &&
        input.data.role !== "GUEST_TEAM_MEMBER"
      ) {
        patch.assignedChannelId = null;
        patch.assignedWorkspaceClientId = null;
        patch.assignedDashboardId = null;
      }

      return ctx.prisma.user.update({
        where: { id: input.id },
        data: patch,
      });
    }),

  // Reset password (admin-set, no email)
  resetPassword: publicProcedure
    .input(z.object({ userId: z.string(), newPassword: z.string().min(6) }))
    .mutation(async ({ ctx, input }) => {
      const hashedPassword = await bcrypt.hash(input.newPassword, 12);
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { password: hashedPassword, mustChangePassword: true },
      });
    }),

  // Reset password AND send email with new credentials
  resetPasswordAndEmail: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
      });
      if (!user) throw new Error("Utilizador nao encontrado.");

      const newPassword = generateTempPassword();
      const hashed = await bcrypt.hash(newPassword, 12);
      const normalizedEmail = user.email.trim().toLowerCase();

      await ctx.prisma.user.update({
        where: { id: user.id },
        data: {
          email: normalizedEmail,
          password: hashed,
          mustChangePassword: true,
          isActive: true,
        },
      });

      const result = await sendPasswordResetEmail({
        name: user.name,
        email: normalizedEmail,
        newPassword,
      });

      return { success: result.success, error: result.error, newPassword, email: normalizedEmail };
    }),

  // User changes own password (first-login flow)
  changeOwnPassword: publicProcedure
    .input(z.object({ userId: z.string(), currentPassword: z.string(), newPassword: z.string().min(8) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: input.userId } });
      if (!user || !user.password) throw new Error("Utilizador invalido.");

      const valid = await bcrypt.compare(input.currentPassword, user.password);
      if (!valid) throw new Error("Password atual incorreta.");

      const hashed = await bcrypt.hash(input.newPassword, 12);
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashed,
          mustChangePassword: false,
        },
      });

      return { success: true };
    }),

  deactivateUser: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.user.update({ where: { id: input }, data: { isActive: false } });
  }),

  activateUser: publicProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    return ctx.prisma.user.update({ where: { id: input }, data: { isActive: true } });
  }),

  // Test email configuration
  testEmail: publicProcedure
    .input(z.object({ to: z.string().email() }))
    .mutation(async ({ input }) => {
      const { sendEmail } = await import("../services/email");
      const result = await sendEmail({
        to: input.to,
        subject: "Teste BoomLab Platform",
        html: `<html><body style="font-family:sans-serif;padding:40px;"><h2>Teste bem-sucedido!</h2><p>O envio de emails da BoomLab Platform esta a funcionar correctamente.</p></body></html>`,
      });
      return result;
    }),
});
