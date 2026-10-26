import type { EventType } from "@prisma/client";
import { venueSideLabel } from "@/lib/matches";
import { MATCH_EVENT_TYPES } from "@/lib/parent-season";
import type { SocialMatchSnapshot } from "@/lib/social-studio/dto";
import { SOCIAL_MATCH_TYPE_LABEL } from "@/lib/social-matches";

const TYPE_LABEL: Record<string, string> = {
  LEAGUE_MATCH: SOCIAL_MATCH_TYPE_LABEL.LEAGUE_MATCH,
  FRIENDLY: SOCIAL_MATCH_TYPE_LABEL.FRIENDLY,
  TOURNAMENT: SOCIAL_MATCH_TYPE_LABEL.TOURNAMENT,
};

export function isStudioMatchEventType(type: EventType | string): boolean {
  return (MATCH_EVENT_TYPES as readonly string[]).includes(type);
}

export function buildMatchSnapshot(row: {
  id: string;
  startAt: Date;
  endAt: Date | null;
  title: string;
  type: string;
  opponentName: string | null;
  isHome: boolean | null;
  location: string | null;
  homeScore: number | null;
  awayScore: number | null;
  seasonLabel: string | null;
  categoryId: string | null;
  categoryName: string | null;
}): SocialMatchSnapshot | null {
  if (!isStudioMatchEventType(row.type)) return null;
  return {
    eventId: row.id,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt ? row.endAt.toISOString() : null,
    title: row.title,
    type: row.type,
    typeLabel: TYPE_LABEL[row.type] ?? "Partita",
    categoryId: row.categoryId,
    categoryName: (row.categoryName ?? "").trim() || "Categoria",
    opponentName: row.opponentName,
    isHome: row.isHome,
    venueSide: venueSideLabel(row.isHome),
    location: row.location,
    homeScore: row.homeScore,
    awayScore: row.awayScore,
    seasonLabel: row.seasonLabel,
  };
}

export function formatKickoffLabel(iso: string): string {
  const date = new Date(iso);
  const dateLabel = new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  const timeLabel = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
  return `${dateLabel} · ${timeLabel}`;
}

export function defaultGraphicTitle(
  template: string,
  snapshot: SocialMatchSnapshot,
): string {
  const opponent =
    (snapshot.opponentName ?? "").trim() || snapshot.title.trim() || "Partita";
  return `${template.replaceAll("_", " ")} · ${snapshot.categoryName} vs ${opponent}`;
}

export function defaultWeekendGraphicTitle(
  template: string,
  weekendLabel: string,
  matchCount: number,
): string {
  const label = template === "WEEKEND_BASE" ? "Attività di Base" : "Settore Agonistico";
  return `${label} · ${weekendLabel} · ${matchCount} gare`;
}
