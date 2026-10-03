import { isMatchEventType, MATCH_EVENT_TYPES } from "@/lib/parent-season";

/** Visual-only fallback when Event.endAt is missing (does not mutate Event). */
export const MATCH_DAY_DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

export type MatchDayPhase = "PRE_MATCH" | "LIVE" | "FULL_TIME";

export type MatchDayCandidate = {
  id: string;
  type: string;
  startAt: Date;
  endAt: Date | null;
};

/**
 * Calendar day bounds for a wall-clock "now" (Europe/Rome values encoded as UTC).
 * Match Day is keyed to this Italian calendar date, not a rolling 24h window.
 */
export function wallClockDayBounds(wallNow: Date): { start: Date; end: Date } {
  const year = wallNow.getUTCFullYear();
  const month = wallNow.getUTCMonth();
  const day = wallNow.getUTCDate();
  return {
    start: new Date(Date.UTC(year, month, day, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, day, 23, 59, 59, 999)),
  };
}

export function isSameWallClockDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export function resolveMatchVisualEndAt(startAt: Date, endAt: Date | null): Date {
  if (endAt) return endAt;
  return new Date(startAt.getTime() + MATCH_DAY_DEFAULT_DURATION_MS);
}

/**
 * PRE_MATCH: wallNow < kickoff
 * LIVE: kickoff <= wallNow <= effectiveEnd (endAt or kickoff+2h)
 * FULL_TIME: wallNow > effectiveEnd
 */
export function resolveMatchDayPhase(input: {
  startAt: Date;
  endAt: Date | null;
  wallNow: Date;
}): MatchDayPhase {
  const effectiveEnd = resolveMatchVisualEndAt(input.startAt, input.endAt);
  if (input.wallNow.getTime() < input.startAt.getTime()) {
    return "PRE_MATCH";
  }
  if (input.wallNow.getTime() <= effectiveEnd.getTime()) {
    return "LIVE";
  }
  return "FULL_TIME";
}

/**
 * Pick the most relevant match among today's candidates:
 * 1) LIVE (closest kickoff to now)
 * 2) PRE_MATCH (soonest kickoff)
 * 3) FULL_TIME (most recent kickoff)
 */
export function selectTodaysMatchDayEvent<T extends MatchDayCandidate>(
  events: T[],
  wallNow: Date,
): T | null {
  const today = events.filter(
    (event) => isMatchEventType(event.type) && isSameWallClockDay(event.startAt, wallNow),
  );
  if (today.length === 0) return null;

  const ranked = today.map((event) => ({
    event,
    phase: resolveMatchDayPhase({
      startAt: event.startAt,
      endAt: event.endAt,
      wallNow,
    }),
  }));

  const live = ranked.filter((row) => row.phase === "LIVE");
  if (live.length > 0) {
    live.sort(
      (a, b) =>
        Math.abs(a.event.startAt.getTime() - wallNow.getTime()) -
        Math.abs(b.event.startAt.getTime() - wallNow.getTime()),
    );
    return live[0]?.event ?? null;
  }

  const upcoming = ranked.filter((row) => row.phase === "PRE_MATCH");
  if (upcoming.length > 0) {
    upcoming.sort((a, b) => a.event.startAt.getTime() - b.event.startAt.getTime());
    return upcoming[0]?.event ?? null;
  }

  const finished = ranked.filter((row) => row.phase === "FULL_TIME");
  finished.sort((a, b) => b.event.startAt.getTime() - a.event.startAt.getTime());
  return finished[0]?.event ?? null;
}

export function buildGoogleMapsSearchUrl(location: string | null | undefined): string | null {
  const query = (location ?? "").trim();
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Resolve display opponent for Match Day.
 * Priority: Event.opponentName → prudent parse from Event.title → "Avversario".
 */
export function resolveMatchDayOpponentName(input: {
  opponentName: string | null | undefined;
  title: string | null | undefined;
}): string {
  const explicit = (input.opponentName ?? "").trim();
  if (explicit) {
    return explicit;
  }

  const title = (input.title ?? "").trim();
  if (!title) {
    return "Avversario";
  }

  const vsMatch = /\bvs\.?\b/i.exec(title);
  if (vsMatch && vsMatch.index != null) {
    const after = title.slice(vsMatch.index + vsMatch[0].length).trim().replace(/^[-–—:]\s*/, "");
    if (after.length >= 2) {
      return after;
    }
  }

  const dashMatch = title.match(/^(.+?)\s*[-–—]\s*(.+)$/);
  if (dashMatch) {
    const left = dashMatch[1].trim();
    const right = dashMatch[2].trim();
    if (/comun\s*nuovo/i.test(left) && right.length >= 2 && !/\bvs\.?\b/i.test(right)) {
      return right;
    }
    if (/comun\s*nuovo/i.test(right) && left.length >= 2 && !/\bvs\.?\b/i.test(left)) {
      return left;
    }
  }

  return "Avversario";
}

/**
 * Short non-redundant label from title when opponent was inferred or explicit
 * (e.g. "Amichevole vs Pro Lurano" → "Amichevole"). Returns null if useless.
 */
export function resolveMatchDaySecondaryLabel(input: {
  title: string | null | undefined;
  resolvedOpponent: string;
}): string | null {
  let label = (input.title ?? "").trim();
  if (!label) return null;

  const opponent = input.resolvedOpponent.trim();
  if (opponent && opponent !== "Avversario") {
    const escaped = opponent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    label = label.replace(new RegExp(`\\s*\\bvs\\.?\\b\\s*${escaped}\\s*$`, "i"), "");
    label = label.replace(new RegExp(`\\s*[-–—]\\s*${escaped}\\s*$`, "i"), "");
    label = label.replace(new RegExp(`^${escaped}\\s*\\bvs\\.?\\b\\s*`, "i"), "");
    label = label.replace(new RegExp(`^${escaped}\\s*[-–—]\\s*`, "i"), "");
  }

  label = label.replace(/\bcomun\s*nuovo\b/gi, "").replace(/^\s*[-–—:]\s*|\s*[-–—:]\s*$/g, "").trim();
  label = label.replace(/\bvs\.?\b/gi, "").trim();

  if (!label) return null;
  if (label.toLowerCase() === opponent.toLowerCase()) return null;
  if (label.length < 2) return null;
  return label;
}

export type MatchDayTeamLayout = {
  topName: string;
  bottomName: string;
  mode: "home" | "away" | "neutral";
};

export function matchDayTeamLayout(input: {
  opponentName: string | null;
  isHome: boolean | null;
  clubName?: string;
}): MatchDayTeamLayout {
  const club = (input.clubName ?? "Comun Nuovo").trim() || "Comun Nuovo";
  const opponent = (input.opponentName ?? "").trim() || "Avversario";

  if (input.isHome === true) {
    return { topName: club, bottomName: opponent, mode: "home" };
  }
  if (input.isHome === false) {
    return { topName: opponent, bottomName: club, mode: "away" };
  }
  return { topName: club, bottomName: opponent, mode: "neutral" };
}

export function matchDayScoreLines(input: {
  opponentName: string | null;
  isHome: boolean | null;
  homeScore: number;
  awayScore: number;
  clubName?: string;
}): { leftName: string; leftScore: number; rightName: string; rightScore: number } {
  const club = (input.clubName ?? "Comun Nuovo").trim() || "Comun Nuovo";
  const opponent = (input.opponentName ?? "").trim() || "Avversario";

  if (input.isHome === false) {
    return {
      leftName: opponent,
      leftScore: input.homeScore,
      rightName: club,
      rightScore: input.awayScore,
    };
  }

  // home or null → club listed with homeScore side
  return {
    leftName: club,
    leftScore: input.homeScore,
    rightName: opponent,
    rightScore: input.awayScore,
  };
}

export function shouldSuppressNextEventForMatchDay(
  nextEventId: string | null | undefined,
  matchDayEventId: string | null | undefined,
): boolean {
  return Boolean(nextEventId && matchDayEventId && nextEventId === matchDayEventId);
}

export { MATCH_EVENT_TYPES };
