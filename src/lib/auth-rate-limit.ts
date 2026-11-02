import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type AuthRateLimitAction = "login" | "register" | "login_email";

const WINDOW_MS = 15 * 60 * 1000;
const LIMITS: Record<AuthRateLimitAction, number> = {
  login: 30,
  register: 10,
  login_email: 15,
};

export function buildAuthRateLimitKey(action: AuthRateLimitAction, identity: string): string {
  const normalized = identity.trim().toLowerCase() || "unknown";
  return `${action}:${normalized}`;
}

export function hashEmailForRateLimit(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex").slice(0, 32);
}

export function getClientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return "unknown";
}

/**
 * Rate limit DB-backed (compatibile Vercel multi-istanza).
 * Fail-open se il DB non è disponibile, per non bloccare login legittimi su outage.
 */
export async function consumeAuthRateLimit(input: {
  action: AuthRateLimitAction;
  identity: string;
  now?: Date;
}): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const now = input.now ?? new Date();
  const bucketKey = buildAuthRateLimitKey(input.action, input.identity);
  const limit = LIMITS[input.action];

  try {
    const existing = await prisma.authRateLimitBucket.findUnique({
      where: { bucketKey },
      select: { id: true, windowStartedAt: true, hitCount: true },
    });

    if (!existing) {
      await prisma.authRateLimitBucket.create({
        data: {
          bucketKey,
          windowStartedAt: now,
          hitCount: 1,
        },
      });
      return { allowed: true };
    }

    const windowAgeMs = now.getTime() - existing.windowStartedAt.getTime();
    if (windowAgeMs >= WINDOW_MS) {
      await prisma.authRateLimitBucket.update({
        where: { bucketKey },
        data: { windowStartedAt: now, hitCount: 1 },
      });
      return { allowed: true };
    }

    if (existing.hitCount >= limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((WINDOW_MS - windowAgeMs) / 1000),
      );
      return { allowed: false, retryAfterSeconds };
    }

    await prisma.authRateLimitBucket.update({
      where: { bucketKey },
      data: { hitCount: { increment: 1 } },
    });
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}
