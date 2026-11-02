import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { authDebugLog } from "@/lib/auth-debug";
import { consumeAuthRateLimit, hashEmailForRateLimit } from "@/lib/auth-rate-limit";
import { prisma } from "@/lib/prisma";
import { applyJwtRoleFromDb } from "@/lib/auth-jwt-role";

const AUTH_DEBUG_PREFIX = "[AUTH_DEBUG]";

/** 30 giorni — allineato al default JWT NextAuth, esplicitato senza ridurre le sessioni attive. */
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
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
        authDebugLog(`${AUTH_DEBUG_PREFIX} authorize: start`, {
          hasEmail: Boolean(credentials?.email),
        });

        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const normalizedEmail = credentials.email.toLowerCase().trim();
        const rate = await consumeAuthRateLimit({
          action: "login_email",
          identity: hashEmailForRateLimit(normalizedEmail),
        });
        if (!rate.allowed) {
          authDebugLog(`${AUTH_DEBUG_PREFIX} authorize: rate limited`);
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: normalizedEmail,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            passwordHash: true,
          },
        });

        if (!user) {
          authDebugLog(`${AUTH_DEBUG_PREFIX} authorize: user not found`);
          return null;
        }

        if (!user.passwordHash) {
          authDebugLog(`${AUTH_DEBUG_PREFIX} authorize: invalid password`);
          return null;
        }

        if (!user.isActive) {
          authDebugLog(`${AUTH_DEBUG_PREFIX} authorize: inactive user`);
          return null;
        }

        const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValidPassword) {
          authDebugLog(`${AUTH_DEBUG_PREFIX} authorize: invalid password`);
          return null;
        }

        authDebugLog(`${AUTH_DEBUG_PREFIX} authorize: success`, {
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
      authDebugLog(`${AUTH_DEBUG_PREFIX} jwt: incoming`, {
        hasTokenSub: Boolean(token.sub),
        tokenRole: token.role,
        hasUser: Boolean(user),
      });

      if (user) {
        token.sub = user.id;
        token.role = (user as { role: UserRole }).role;
      }

      // Sempre riallinea il ruolo dal DB: dopo una promozione a mister
      // (PARENT → COACH) il JWT non deve restare bloccato sul ruolo precedente.
      // Se il DB non è raggiungibile, mantieni il ruolo già presente nel token.
      if (token.sub || token.email) {
        const orConditions = [
          token.sub ? { id: token.sub } : null,
          token.email ? { email: String(token.email) } : null,
        ].filter((value): value is { id: string } | { email: string } => Boolean(value));

        try {
          const userFromDb = await prisma.user.findFirst({
            where: {
              OR: orConditions,
            },
            select: {
              role: true,
              id: true,
              email: true,
              isActive: true,
            },
          });

          const previousRole = token.role;
          const next = applyJwtRoleFromDb(
            {
              sub: typeof token.sub === "string" ? token.sub : undefined,
              email: typeof token.email === "string" ? token.email : undefined,
              role: token.role as UserRole | undefined,
            },
            userFromDb,
          );
          token.sub = next.sub;
          token.email = next.email;
          if (next.role) {
            token.role = next.role as UserRole;
          } else {
            delete token.role;
          }

          if (previousRole !== token.role) {
            authDebugLog(`${AUTH_DEBUG_PREFIX} jwt: role refreshed from db`, {
              previousRole,
              tokenRole: token.role,
            });
          }
        } catch (error) {
          console.error(`${AUTH_DEBUG_PREFIX} jwt: db unreachable, keeping token role`, {
            error: error instanceof Error ? error.message : "unknown",
          });
          const kept = applyJwtRoleFromDb(token, null, { dbUnreachable: true });
          Object.assign(token, kept);
        }
      }

      authDebugLog(`${AUTH_DEBUG_PREFIX} jwt: outgoing`, {
        hasTokenSub: Boolean(token.sub),
        tokenRole: token.role,
      });

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        // Non fare fallback a PARENT: senza ruolo valido le pagine proteggono via redirect.
        if (token.role) {
          session.user.role = token.role as UserRole;
        }
      }

      authDebugLog(`${AUTH_DEBUG_PREFIX} session: outgoing`, {
        hasSessionUser: Boolean(session.user?.id),
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
        YOUTH_DIRECTOR: "/admin",
        SOCIAL_MEDIA_MANAGER: "/social/calendario",
      };

      if (resolvedUrl.origin !== appOrigin) {
        return baseUrl;
      }

      const roleFromQuery = resolvedUrl.searchParams.get("role") as UserRole | null;
      const mappedRolePath = roleFromQuery ? roleHomeByRole[roleFromQuery] : undefined;
      const finalUrl = mappedRolePath ? `${baseUrl}${mappedRolePath}` : resolvedUrl.toString();

      authDebugLog(`${AUTH_DEBUG_PREFIX} redirect callback`, {
        hasMappedRole: Boolean(mappedRolePath),
      });

      return finalUrl;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
