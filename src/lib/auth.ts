import { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) return null;
        if (!user.isActive) return null;

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      if (account?.provider === "google") {
        // Try to find user by Google email
        let dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        // If not found by Google email, find ANY active admin/consultant/manager
        // and link Google to them (first time connection)
        if (!dbUser) {
          // Check if there's a user who already has this Google account linked
          const existingAccount = await prisma.account.findFirst({
            where: {
              provider: "google",
              providerAccountId: account.providerAccountId,
            },
            include: { user: true },
          });

          if (existingAccount) {
            dbUser = existingAccount.user;
          } else {
            // Auto-create user from Google if they have a boomlab.agency email
            // OR link to existing user by creating the account
            const isBoomLabEmail = user.email.endsWith("@boomlab.agency");

            if (isBoomLabEmail) {
              // Create user automatically for BoomLab team members
              dbUser = await prisma.user.create({
                data: {
                  name: user.name ?? user.email.split("@")[0],
                  email: user.email,
                  role: "CONSULTANT",
                  isActive: true,
                  googleConnected: true,
                  image: user.image,
                },
              });
            } else {
              // For non-BoomLab emails, check if we should allow
              // This allows external Google accounts to connect
              // We create them as a user so Calendar/Docs works
              dbUser = await prisma.user.create({
                data: {
                  name: user.name ?? user.email.split("@")[0],
                  email: user.email,
                  role: "CONSULTANT",
                  isActive: true,
                  googleConnected: true,
                  image: user.image,
                },
              });
            }
          }
        }

        if (!dbUser || !dbUser.isActive) return false;

        // Update user with Google info
        await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            image: user.image ?? dbUser.image,
            googleConnected: true,
          },
        });

        // Save Google tokens
        await prisma.account.upsert({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
          update: {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            scope: account.scope,
          },
          create: {
            userId: dbUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          },
        });

        // Override the user email/id to match the DB user
        user.email = dbUser.email;
        (user as Record<string, unknown>).id = dbUser.id;

        return true;
      }

      // Credentials login
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });
      if (!dbUser || !dbUser.isActive) return false;

      return true;
    },

    async session({ session }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
        });
        if (dbUser) {
          (session.user as Record<string, unknown>).id = dbUser.id;
          (session.user as Record<string, unknown>).role = dbUser.role;
          (session.user as Record<string, unknown>).googleConnected = dbUser.googleConnected;
          (session.user as Record<string, unknown>).mustChangePassword = dbUser.mustChangePassword;
          (session.user as Record<string, unknown>).assignedChannelId = dbUser.assignedChannelId;
          (session.user as Record<string, unknown>).assignedWorkspaceClientId = dbUser.assignedWorkspaceClientId;
        }
      }
      return session;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = (user as Record<string, unknown>).id ?? user.id;
        token.email = user.email;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
