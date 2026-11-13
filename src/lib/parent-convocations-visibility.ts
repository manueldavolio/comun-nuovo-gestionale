import type { Prisma } from "@prisma/client";

/** Max historical (già iniziate/passate) rows kept after loading all upcoming. */
export const PARENT_CONVOCATIONS_HISTORY_TAKE = 150;

/** Event still open / not finished (wall-clock stored as UTC fields). */
export function parentUpcomingEventWhere(wallNow: Date): Prisma.EventWhereInput {
  return {
    OR: [
      { endAt: { gte: wallNow } },
      { AND: [{ endAt: null }, { startAt: { gte: wallNow } }] },
    ],
  };
}

export function parentPastEventWhere(wallNow: Date): Prisma.EventWhereInput {
  return {
    OR: [
      { endAt: { lt: wallNow } },
      { AND: [{ endAt: null }, { startAt: { lt: wallNow } }] },
    ],
  };
}

/**
 * Merge upcoming (must all stay visible) with capped recent history.
 * Upcoming first; historical follow; duplicates by id dropped.
 */
export function mergeParentConvocationEntriesForDisplay<T extends { id: string }>(options: {
  upcoming: T[];
  recentHistorical: T[];
}): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const entry of options.upcoming) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(entry);
  }
  for (const entry of options.recentHistorical) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(entry);
  }
  return result;
}

/**
 * Pure check: with asc+takeN on a mixed timeline, would any upcoming id be dropped?
 * Used in regression tests for the historical bug.
 */
export function upcomingIdsDroppedByOldestTake<T extends { id: string; startAt: Date }>(options: {
  entries: T[];
  take: number;
  wallNow: Date;
}): string[] {
  const oldestFirst = [...options.entries].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime() || a.id.localeCompare(b.id),
  );
  const kept = new Set(oldestFirst.slice(0, options.take).map((entry) => entry.id));
  return options.entries
    .filter((entry) => entry.startAt.getTime() >= options.wallNow.getTime() && !kept.has(entry.id))
    .map((entry) => entry.id);
}
