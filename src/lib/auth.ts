import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const AUTH_DEBUG_PREFIX = "[AUTH_DEBUG]";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.info(`${AUTH_DEBUG_PREFIX} authorize: start`, {
          email: credentials?.email?.toLowerCase().trim() ?? null,
        });

        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const normalizedEmail = credentials.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: {
            email: normalizedEmail,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            passwordHash: true,
          },
        });

        if (!user) {
          console.info(`${AUTH_DEBUG_PREFIX} authorize: user not found`, {
            email: normalizedEmail,
          });
          return null;
        }

        if (!user.passwordHash) {
          console.info(`${AUTH_DEBUG_PREFIX} authorize: invalid password`, {
            email: normalizedEmail,
          });
          return null;
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValidPassword) {
          console.info(`${AUTH_DEBUG_PREFIX} authorize: invalid password`, {
            email: normalizedEmail,
          });
          return null;
        }

        console.info(`${AUTH_DEBUG_PREFIX} authorize: success`, {
          userId: user.id,
          email: user.email,
          role: user.role,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      console.info(`${AUTH_DEBUG_PREFIX} jwt: incoming`, {
        tokenSub: token.sub,
        tokenRole: token.role,
        hasUser: Boolean(user),
        userId: user?.id,
        userEmail: user?.email,
        userRole: (user as { role?: UserRole } | undefined)?.role,
      });

      if (user) {
        token.sub = user.id;
        token.role = (user as { role: UserRole }).role;
      }

      if (!token.role && (token.sub || token.email)) {
        const orConditions = [
          token.sub ? { id: token.sub } : null,
          token.email ? { email: token.email } : null,
        ].filter((value): value is { id: string } | { email: string } => Boolean(value));

        const userFromDb = await prisma.user.findFirst({
          where: {
            OR: orConditions,
          },
          select: {
            role: true,
            id: true,
            email: true,
          },
        });

        if (userFromDb) {
          token.sub = userFromDb.id;
          token.email = userFromDb.email;
          token.role = userFromDb.role;
          console.info(`${AUTH_DEBUG_PREFIX} jwt: role hydrated from db`, {
            tokenSub: token.sub,
            tokenEmail: token.email,
            tokenRole: token.role,
          });
        } else {
          console.info(`${AUTH_DEBUG_PREFIX} jwt: no db user for token`, {
            tokenSub: token.sub,
            tokenEmail: token.email,
          });
        }
      }

      console.info(`${AUTH_DEBUG_PREFIX} jwt: outgoing`, {
        tokenSub: token.sub,
        tokenRole: token.role,
      });

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as UserRole | undefined) ?? "PARENT";
      }

      console.info(`${AUTH_DEBUG_PREFIX} session: outgoing`, {
        sessionUserId: session.user?.id,
        sessionUserEmail: session.user?.email,
        sessionUserRole: session.user?.role,
      });

      return session;
    },
    async redirect({ url, baseUrl }) {
      const resolvedUrl = new URL(url, baseUrl);
      const appOrigin = new URL(baseUrl).origin;
      const roleHomeByRole: Partial<Record<UserRole, string>> = {
        ADMIN: "/admin",
        COACH: "/mister",
        PARENT: "/genitore",
      };

      if (resolvedUrl.origin !== appOrigin) {
        return baseUrl;
      }

      const roleFromQuery = resolvedUrl.searchParams.get("role") as UserRole | null;
      const mappedRolePath = roleFromQuery ? roleHomeByRole[roleFromQuery] : undefined;
      const finalUrl = mappedRolePath ? `${baseUrl}${mappedRolePath}` : resolvedUrl.toString();

      console.info(`${AUTH_DEBUG_PREFIX} redirect callback`, {
        requestedUrl: url,
        baseUrl,
        finalUrl,
      });

      return finalUrl;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
