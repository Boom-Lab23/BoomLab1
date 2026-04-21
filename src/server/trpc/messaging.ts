import { z } from "zod";
import { router, publicProcedure } from "./init";

// Default permissions by role
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  OWNER: [
    "SEND_MESSAGES", "DELETE_MESSAGES", "DELETE_ANY_MESSAGE", "PIN_MESSAGES",
    "INVITE_MEMBERS", "REMOVE_MEMBERS", "MANAGE_SUB_CHANNELS", "MANAGE_PERMISSIONS",
    "UPLOAD_FILES", "VIEW_HISTORY",
  ],
  ADMIN: [
    "SEND_MESSAGES", "DELETE_MESSAGES", "DELETE_ANY_MESSAGE", "PIN_MESSAGES",
    "INVITE_MEMBERS", "REMOVE_MEMBERS", "MANAGE_SUB_CHANNELS",
    "UPLOAD_FILES", "VIEW_HISTORY",
  ],
  MEMBER: [
    "SEND_MESSAGES", "DELETE_MESSAGES", "PIN_MESSAGES", "UPLOAD_FILES", "VIEW_HISTORY",
  ],
  GUEST: ["VIEW_HISTORY"],
};

export const messagingRouter = router({
  // =====================
  // CHANNELS
  // =====================

  channels: publicProcedure
    .input(
      z.object({
        type: z.enum(["CLIENT", "TEAM", "GENERAL", "DIRECT"]).optional(),
        clientId: z.string().optional(),
        userId: z.string().optional(), // Filter to only channels this user is a member of
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = { isArchived: false };
      if (input?.type) where.type = input.type;
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.userId) {
        where.members = { some: { userId: input.userId } };
      }

      return ctx.prisma.channel.findMany({
        where,
        include: {
          client: true,
          subChannels: {
            where: { isArchived: false },
            orderBy: { createdAt: "asc" },
          },
          members: { include: { user: true, permissions: true } },
          _count: { select: { messages: true, members: true, subChannels: true } },
          messages: {
            where: { subChannelId: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { author: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  getChannel: publicProcedure
    .input(z.object({
      channelId: z.string(),
      limit: z.number().default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const channel = await ctx.prisma.channel.findUniqueOrThrow({
        where: { id: input.channelId },
        include: {
          client: true,
          subChannels: {
            where: { isArchived: false },
            include: {
              _count: { select: { messages: true, members: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          members: {
            include: {
              user: true,
              permissions: true,
            },
          },
        },
      });

      // Messages in main channel (not sub-channels)
      const messages = await ctx.prisma.message.findMany({
        where: {
          channelId: input.channelId,
          subChannelId: null,
          parentId: null,
        },
        include: {
          author: true,
          _count: { select: { replies: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = messages.length > input.limit;
      if (hasMore) messages.pop();

      return {
        channel,
        messages: messages.reverse(),
        nextCursor: hasMore ? messages[0]?.id : undefined,
      };
    }),

  createChannel: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(["CLIENT", "TEAM", "GENERAL"]).default("CLIENT"),
        clientId: z.string().optional(),
        createdById: z.string(),
        isPrivate: z.boolean().default(false),
        memberIds: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.prisma.channel.create({
        data: {
          name: input.name,
          description: input.description,
          type: input.type,
          clientId: input.clientId,
          createdById: input.createdById,
          isPrivate: input.isPrivate,
        },
      });

      // Add creator as OWNER with all permissions
      const ownerMember = await ctx.prisma.channelMember.create({
        data: {
          channelId: channel.id,
          userId: input.createdById,
          role: "OWNER",
        },
      });

      // Create default permissions for owner
      await ctx.prisma.channelPermission.createMany({
        data: DEFAULT_PERMISSIONS.OWNER.map((p) => ({
          channelMemberId: ownerMember.id,
          permission: p as "SEND_MESSAGES",
          granted: true,
        })),
      });

      // Add additional members
      for (const userId of input.memberIds) {
        if (userId === input.createdById) continue;
        const member = await ctx.prisma.channelMember.create({
          data: {
            channelId: channel.id,
            userId,
            role: "MEMBER",
          },
        });
        await ctx.prisma.channelPermission.createMany({
          data: DEFAULT_PERMISSIONS.MEMBER.map((p) => ({
            channelMemberId: member.id,
            permission: p as "SEND_MESSAGES",
            granted: true,
          })),
        });
      }

      return channel;
    }),

  // Update channel (name, description, privacy, icon)
  updateChannel: publicProcedure
    .input(z.object({
      channelId: z.string(),
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      icon: z.string().nullable().optional(),
      isPrivate: z.boolean().optional(),
      isArchived: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { channelId, ...data } = input;
      return ctx.prisma.channel.update({
        where: { id: channelId },
        data,
      });
    }),

  // Delete channel (cascades to sub-channels + messages)
  deleteChannel: publicProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.channel.delete({ where: { id: input.channelId } });
    }),

  // =====================
  // SUB-CHANNELS
  // =====================

  getSubChannel: publicProcedure
    .input(z.object({
      subChannelId: z.string(),
      limit: z.number().default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const subChannel = await ctx.prisma.subChannel.findUniqueOrThrow({
        where: { id: input.subChannelId },
        include: {
          channel: { include: { client: true } },
          members: { include: { user: true } },
        },
      });

      const messages = await ctx.prisma.message.findMany({
        where: {
          subChannelId: input.subChannelId,
          parentId: null,
        },
        include: {
          author: true,
          _count: { select: { replies: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = messages.length > input.limit;
      if (hasMore) messages.pop();

      return {
        subChannel,
        messages: messages.reverse(),
        nextCursor: hasMore ? messages[0]?.id : undefined,
      };
    }),

  createSubChannel: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        channelId: z.string(),
        createdById: z.string(),
        isPrivate: z.boolean().default(false),
        memberIds: z.array(z.string()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const subChannel = await ctx.prisma.subChannel.create({
        data: {
          name: input.name,
          description: input.description,
          channelId: input.channelId,
          createdById: input.createdById,
          isPrivate: input.isPrivate,
        },
      });

      // Add creator
      await ctx.prisma.subChannelMember.create({
        data: {
          subChannelId: subChannel.id,
          userId: input.createdById,
          role: "ADMIN",
        },
      });

      // Add members
      for (const userId of input.memberIds) {
        if (userId === input.createdById) continue;
        await ctx.prisma.subChannelMember.create({
          data: {
            subChannelId: subChannel.id,
            userId,
            role: "MEMBER",
          },
        });
      }

      return subChannel;
    }),

  // =====================
  // MEMBERS & PERMISSIONS
  // =====================

  addMember: publicProcedure
    .input(
      z.object({
        channelId: z.string(),
        userId: z.string(),
        role: z.enum(["ADMIN", "MEMBER", "GUEST"]).default("MEMBER"),
        subChannelIds: z.array(z.string()).default([]), // Which sub-channels to grant access
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.channelMember.create({
        data: {
          channelId: input.channelId,
          userId: input.userId,
          role: input.role,
        },
      });

      // Set default permissions for the role
      const perms = DEFAULT_PERMISSIONS[input.role] ?? DEFAULT_PERMISSIONS.MEMBER;
      await ctx.prisma.channelPermission.createMany({
        data: perms.map((p) => ({
          channelMemberId: member.id,
          permission: p as "SEND_MESSAGES",
          granted: true,
        })),
      });

      // Add to specified sub-channels
      for (const subChannelId of input.subChannelIds) {
        await ctx.prisma.subChannelMember.create({
          data: {
            subChannelId,
            userId: input.userId,
            role: input.role === "GUEST" ? "GUEST" as never : "MEMBER",
          },
        });
      }

      return member;
    }),

  removeMember: publicProcedure
    .input(
      z.object({
        channelId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Remove from all sub-channels first
      const subChannels = await ctx.prisma.subChannel.findMany({
        where: { channelId: input.channelId },
      });
      for (const sc of subChannels) {
        await ctx.prisma.subChannelMember.deleteMany({
          where: { subChannelId: sc.id, userId: input.userId },
        });
      }

      // Remove from channel (cascades permissions)
      await ctx.prisma.channelMember.deleteMany({
        where: { channelId: input.channelId, userId: input.userId },
      });

      return { success: true };
    }),

  updateMemberRole: publicProcedure
    .input(
      z.object({
        channelId: z.string(),
        userId: z.string(),
        role: z.enum(["OWNER", "ADMIN", "MEMBER", "GUEST"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.channelMember.findFirst({
        where: { channelId: input.channelId, userId: input.userId },
      });
      if (!member) throw new Error("Membro nao encontrado");

      // Update role
      await ctx.prisma.channelMember.update({
        where: { id: member.id },
        data: { role: input.role },
      });

      // Reset permissions to match new role
      await ctx.prisma.channelPermission.deleteMany({
        where: { channelMemberId: member.id },
      });

      const perms = DEFAULT_PERMISSIONS[input.role] ?? DEFAULT_PERMISSIONS.MEMBER;
      await ctx.prisma.channelPermission.createMany({
        data: perms.map((p) => ({
          channelMemberId: member.id,
          permission: p as "SEND_MESSAGES",
          granted: true,
        })),
      });

      return { success: true };
    }),

  updatePermission: publicProcedure
    .input(
      z.object({
        channelId: z.string(),
        userId: z.string(),
        permission: z.string(),
        granted: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.channelMember.findFirst({
        where: { channelId: input.channelId, userId: input.userId },
      });
      if (!member) throw new Error("Membro nao encontrado");

      return ctx.prisma.channelPermission.upsert({
        where: {
          channelMemberId_permission: {
            channelMemberId: member.id,
            permission: input.permission as "SEND_MESSAGES",
          },
        },
        update: { granted: input.granted },
        create: {
          channelMemberId: member.id,
          permission: input.permission as "SEND_MESSAGES",
          granted: input.granted,
        },
      });
    }),

  // Update sub-channel access for a member
  updateSubChannelAccess: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        subChannelId: z.string(),
        hasAccess: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.hasAccess) {
        await ctx.prisma.subChannelMember.upsert({
          where: {
            subChannelId_userId: {
              subChannelId: input.subChannelId,
              userId: input.userId,
            },
          },
          update: {},
          create: {
            subChannelId: input.subChannelId,
            userId: input.userId,
            role: "MEMBER",
          },
        });
      } else {
        await ctx.prisma.subChannelMember.deleteMany({
          where: {
            subChannelId: input.subChannelId,
            userId: input.userId,
          },
        });
      }
      return { success: true };
    }),

  // =====================
  // MESSAGES
  // =====================

  sendMessage: publicProcedure
    .input(
      z.object({
        content: z.string().min(1),
        channelId: z.string().optional(),
        subChannelId: z.string().optional(),
        authorId: z.string(),
        parentId: z.string().optional(),
        isSystem: z.boolean().default(false),
        metadata: z.record(z.unknown()).optional(),
        attachments: z.array(z.object({
          name: z.string(),
          url: z.string(),
          size: z.number().optional(),
          type: z.string().optional(),
        })).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.prisma.message.create({
        data: {
          content: input.content,
          channelId: input.channelId,
          subChannelId: input.subChannelId,
          authorId: input.authorId,
          parentId: input.parentId,
          isSystem: input.isSystem,
          metadata: input.metadata,
          attachments: input.attachments,
        },
        include: { author: true },
      });

      // Update channel/subchannel updatedAt
      if (input.channelId) {
        await ctx.prisma.channel.update({
          where: { id: input.channelId },
          data: { updatedAt: new Date() },
        });
      }
      if (input.subChannelId) {
        await ctx.prisma.subChannel.update({
          where: { id: input.subChannelId },
          data: { updatedAt: new Date() },
        });
      }

      return message;
    }),

  editMessage: publicProcedure
    .input(z.object({ messageId: z.string(), content: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.message.update({
        where: { id: input.messageId },
        data: { content: input.content, editedAt: new Date() },
      });
    }),

  deleteMessage: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.message.delete({ where: { id: input } });
    }),

  togglePin: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.prisma.message.findUniqueOrThrow({ where: { id: input } });
      return ctx.prisma.message.update({
        where: { id: input },
        data: { isPinned: !msg.isPinned },
      });
    }),

  getThread: publicProcedure
    .input(z.string())
    .query(async ({ ctx, input }) => {
      const parent = await ctx.prisma.message.findUniqueOrThrow({
        where: { id: input },
        include: { author: true },
      });
      const replies = await ctx.prisma.message.findMany({
        where: { parentId: input },
        include: { author: true },
        orderBy: { createdAt: "asc" },
      });
      return { parent, replies };
    }),

  // Auto-create client channels
  autoCreateClientChannels: publicProcedure
    .input(z.string())
    .mutation(async ({ ctx, input }) => {
      const clientsWithoutChannel = await ctx.prisma.client.findMany({
        where: { status: "ATIVO", channels: { none: {} } },
      });

      const created: string[] = [];
      for (const client of clientsWithoutChannel) {
        const channel = await ctx.prisma.channel.create({
          data: {
            name: client.name,
            description: `Canal do cliente ${client.name}`,
            type: "CLIENT",
            clientId: client.id,
            createdById: input,
            isPrivate: true,
          },
        });

        // Add creator as owner
        const member = await ctx.prisma.channelMember.create({
          data: { channelId: channel.id, userId: input, role: "OWNER" },
        });
        await ctx.prisma.channelPermission.createMany({
          data: DEFAULT_PERMISSIONS.OWNER.map((p) => ({
            channelMemberId: member.id,
            permission: p as "SEND_MESSAGES",
            granted: true,
          })),
        });

        // Create default sub-channels
        for (const subName of ["Geral", "Planos de Acao", "Documentos"]) {
          const sub = await ctx.prisma.subChannel.create({
            data: {
              name: subName,
              channelId: channel.id,
              createdById: input,
            },
          });
          await ctx.prisma.subChannelMember.create({
            data: { subChannelId: sub.id, userId: input, role: "ADMIN" },
          });
        }

        created.push(client.name);
      }

      return { created };
    }),
});
