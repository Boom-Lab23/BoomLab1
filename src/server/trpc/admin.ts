import { z } from "zod";
import { router, publicProcedure } from "./init";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail, sendPasswordResetEmail, generateTempPassword } from "../services/email";

export const adminRouter = router({
  // ============================================================
  // GUEST_CLIENT — gerir a propria equipa (GUEST_TEAM_MEMBER)
  // Cliente so pode criar/listar/apagar membros da sua equipa
  // (mesmo assignedWorkspaceClientId).
  // ============================================================
  myTeamList: publicProcedure.query(async ({ ctx }) => {
    const user = ctx.session?.user as Record<string, unknown> | undefined;
    if (!user) throw new Error("Sem sessao.");
    const role = user.role as string | undefined;
    const myClientId = user.assignedWorkspaceClientId as string | undefined;
    if (role !== "GUEST_CLIENT" || !myClientId) {
      throw new Error("So clientes (GUEST_CLIENT) podem gerir equipa propria.");
    }
    return ctx.prisma.user.findMany({
      where: {
        role: "GUEST_TEAM_MEMBER",
        assignedWorkspaceClientId: myClientId,
        isActive: true,
      },
      select: { id: true, name: true, email: true, createdAt: true, isActive: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  myTeamAdd: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as Record<string, unknown> | undefined;
      if (!user) throw new Error("Sem sessao.");
      const role = user.role as string | undefined;
      const myClientId = user.assignedWorkspaceClientId as string | undefined;
      const myChannelId = user.assignedChannelId as string | undefined;
      if (role !== "GUEST_CLIENT" || !myClientId) {
        throw new Error("So clientes (GUEST_CLIENT) podem adicionar membros.");
      }

      const normalizedEmail = input.email.trim().toLowerCase();
      const existing = await ctx.prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      });
      if (existing) throw new Error("Email ja registado.");

      const plainPassword = generateTempPassword();
      const hashedPassword = await bcrypt.hash(plainPassword, 12);

      const newUser = await ctx.prisma.user.create({
        data: {
          name: input.name,
          email: normalizedEmail,
          password: hashedPassword,
          role: "GUEST_TEAM_MEMBER",
          isActive: true,
          assignedWorkspaceClientId: myClientId,
          assignedChannelId: myChannelId ?? null,
          mustChangePassword: true,
        },
      });

      // Email de welcome ao novo membro
      sendWelcomeEmail({
        name: input.name,
        email: normalizedEmail,
        password: plainPassword,
        role: "GUEST_TEAM_MEMBER",
      }).catch((err) => console.error("[myTeamAdd] welcome email failed:", err));

      return { id: newUser.id, name: newUser.name, email: newUser.email };
    }),

  myTeamRemove: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const user = ctx.session?.user as Record<string, unknown> | undefined;
      if (!user) throw new Error("Sem sessao.");
      const role = user.role as string | undefined;
      const myClientId = user.assignedWorkspaceClientId as string | undefined;
      if (role !== "GUEST_CLIENT" || !myClientId) {
        throw new Error("So clientes (GUEST_CLIENT) podem remover membros.");
      }
      // Verifica que o user que vai ser removido pertence mesmo ao client do GUEST_CLIENT
      const target = await ctx.prisma.user.findUnique({ where: { id: input.userId } });
      if (!target || target.assignedWorkspaceClientId !== myClientId || target.role !== "GUEST_TEAM_MEMBER") {
        throw new Error("Membro nao encontrado ou nao pertence a tua equipa.");
      }
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data: { isActive: false },
      });
    }),

  // Limpa acessos restritos de users non-guest (migracao one-off para dados antigos)
  cleanupNonGuestAccesses: publicProcedure.mutation(async ({ ctx }) => {
    const result = await ctx.prisma.user.updateMany({
      where: {
        role: { in: ["ADMIN", "CONSULTANT", "MANAGER"] },
        OR: [
          { assignedChannelId: { not: null } },
          { assignedWorkspaceClientId: { not: null } },
          { assignedDashboardId: { not: null } },
        ],
      },
      data: {
        assignedChannelId: null,
        assignedWorkspaceClientId: null,
        assignedDashboardId: null,
      },
    });
    return { cleaned: result.count };
  }),

  // List all users
  listUsers: publicProcedure.query(async ({ ctx }) => {
    // Auto-cleanup SINCRONO: limpa acessos obsoletos de non-guests antes de devolver.
    // Garante que o admin ve sempre o estado correcto (gestores/admin/consultant sem acessos restritos).
    await ctx.prisma.user.updateMany({
      where: {
        role: { in: ["ADMIN", "CONSULTANT", "MANAGER"] },
        OR: [
          { assignedChannelId: { not: null } },
          { assignedWorkspaceClientId: { not: null } },
          { assignedDashboardId: { not: null } },
        ],
      },
      data: {
        assignedChannelId: null,
        assignedWorkspaceClientId: null,
        assignedDashboardId: null,
      },
    }).catch((err) => console.error("[listUsers] cleanup failed:", err));

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

      // Se email esta a ser mudado, normaliza e verifica duplicados
      if (typeof input.data.email === "string") {
        const normalized = input.data.email.trim().toLowerCase();
        const existing = await ctx.prisma.user.findFirst({
          where: { email: { equals: normalized, mode: "insensitive" }, NOT: { id: input.id } },
        });
        if (existing) {
          throw new Error("Este email ja esta registado noutro utilizador.");
        }
        patch.email = normalized;
      }
      if (typeof input.data.name === "string") {
        patch.name = input.data.name.trim();
      }

      return ctx.prisma.user.update({
        where: { id: input.id },
        data: patch,
      });
    }),

  // Qualquer user pode editar o seu proprio nome e email.
  // Nao pode mudar role, isActive, nem acessos (so admin em updateUser).
  updateOwnProfile: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name.trim();
      if (input.email !== undefined) {
        const normalized = input.email.trim().toLowerCase();
        // Verifica se email ja existe noutro user
        const existing = await ctx.prisma.user.findFirst({
          where: { email: { equals: normalized, mode: "insensitive" }, NOT: { id: input.userId } },
        });
        if (existing) {
          throw new Error("Este email ja esta registado noutro utilizador.");
        }
        data.email = normalized;
      }
      if (Object.keys(data).length === 0) {
        throw new Error("Nada para actualizar.");
      }
      return ctx.prisma.user.update({
        where: { id: input.userId },
        data,
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
