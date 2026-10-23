import "server-only";

import { calendarMonthBounds, parseYearMonthParam } from "@/lib/calendar-range";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import {
  SOCIAL_MATCH_EVENT_TYPES,
  assertNoSocialPayloadLeak,
  toSocialMatchDto,
  type SocialMatchDto,
} from "@/lib/social-matches";
import { prisma } from "@/lib/prisma";

export type SocialMatchesQuery = {
  /** `YYYY-MM` wall-clock. Default: mese corrente. */
  month?: string | null;
  categoryId?: string | null;
};

export async function listSocialMatches(query: SocialMatchesQuery = {}): Promise<{
  month: string;
  matches: SocialMatchDto[];
  categories: Array<{ id: string; name: string }>;
}> {
  const wallNow = nowAsEuropeRomeWallClockUtc();
  const parsed =
    parseYearMonthParam(query.month) ??
    ({
      year: wallNow.getUTCFullYear(),
      monthIndex0: wallNow.getUTCMonth(),
    } as const);
  const { start, end } = calendarMonthBounds(parsed.year, parsed.monthIndex0);
  const month = `${parsed.year}-${String(parsed.monthIndex0 + 1).padStart(2, "0")}`;
  const categoryId = (query.categoryId ?? "").trim();

  const [categories, events] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.event.findMany({
      where: {
        type: { in: [...SOCIAL_MATCH_EVENT_TYPES] },
        startAt: { gte: start, lte: end },
        ...(categoryId ? { categoryId } : {}),
      },
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        startAt: true,
        endAt: true,
        opponentName: true,
        isHome: true,
        location: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const matches = events
    .map((event) =>
      toSocialMatchDto({
        id: event.id,
        startAt: event.startAt,
        endAt: event.endAt,
        title: event.title,
        type: event.type,
        opponentName: event.opponentName,
        isHome: event.isHome,
        location: event.location,
        categoryName: event.category?.name ?? null,
      }),
    )
    .filter((row): row is SocialMatchDto => row != null);

  const payload = { month, matches, categories };
  assertNoSocialPayloadLeak(payload);
  return payload;
}
