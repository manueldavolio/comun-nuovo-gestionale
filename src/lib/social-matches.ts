import type { EventType } from "@prisma/client";
import { MATCH_EVENT_TYPES } from "@/lib/parent-season";
import { venueSideLabel } from "@/lib/matches";

/** Tipi evento ammessi al calendario social (solo gare pubbliche). */
export const SOCIAL_MATCH_EVENT_TYPES: EventType[] = [...MATCH_EVENT_TYPES];

export type SocialMatchDto = {
  id: string;
  startAt: string;
  endAt: string | null;
  categoryName: string;
  opponentName: string | null;
  isHome: boolean | null;
  venueSide: string;
  location: string | null;
  title: string;
  type: "LEAGUE_MATCH" | "FRIENDLY" | "TOURNAMENT";
  typeLabel: string;
};

export const SOCIAL_MATCH_TYPE_LABEL: Record<SocialMatchDto["type"], string> = {
  LEAGUE_MATCH: "Partita",
  FRIENDLY: "Amichevole",
  TOURNAMENT: "Torneo",
};

/** Campi vietati nei payload social (anti-leak). */
export const SOCIAL_FORBIDDEN_PAYLOAD_KEYS = [
  "athleteId",
  "athlete",
  "athletes",
  "parent",
  "parents",
  "email",
  "phone",
  "taxCode",
  "passwordHash",
  "notes",
  "coachNote",
  "matchPlayerRating",
  "matchPlayerRatings",
  "possessionScore",
  "disciplinaryIncident",
  "convocation",
  "attendance",
  "homeScore",
  "awayScore",
  "manageHref",
  "editHref",
  "deleteEndpoint",
  "convocationHref",
] as const;

export function isSocialMatchEventType(
  type: string,
): type is SocialMatchDto["type"] {
  return (SOCIAL_MATCH_EVENT_TYPES as readonly string[]).includes(type);
}

export function toSocialMatchDto(row: {
  id: string;
  startAt: Date;
  endAt: Date | null;
  title: string;
  type: string;
  opponentName: string | null;
  isHome: boolean | null;
  location: string | null;
  categoryName: string | null;
}): SocialMatchDto | null {
  if (!isSocialMatchEventType(row.type)) return null;
  return {
    id: row.id,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt ? row.endAt.toISOString() : null,
    categoryName: (row.categoryName ?? "").trim() || "Categoria",
    opponentName: row.opponentName,
    isHome: row.isHome,
    venueSide: venueSideLabel(row.isHome),
    location: row.location,
    title: row.title,
    type: row.type,
    typeLabel: SOCIAL_MATCH_TYPE_LABEL[row.type],
  };
}

export function findSocialPayloadLeaks(value: unknown, path = "", found: string[] = []): string[] {
  if (value == null || typeof value !== "object") return found;
  if (value instanceof Date) return found;
  if (Array.isArray(value)) {
    value.forEach((item, i) => findSocialPayloadLeaks(item, `${path}[${i}]`, found));
    return found;
  }
  const forbidden = new Set<string>(SOCIAL_FORBIDDEN_PAYLOAD_KEYS);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    if (forbidden.has(key)) found.push(next);
    findSocialPayloadLeaks(nested, next, found);
  }
  return found;
}

export function assertNoSocialPayloadLeak(payload: unknown): void {
  const leaks = findSocialPayloadLeaks(payload);
  if (leaks.length > 0) {
    throw new Error(`Social matches payload leak: ${leaks.join(", ")}`);
  }
}

export function decideSocialMatchesAccess(input: {
  authenticated: boolean;
  role: string | null | undefined;
}): { ok: true } | { ok: false; status: 401 | 403 } {
  if (!input.authenticated) return { ok: false, status: 401 };
  if (input.role !== "SOCIAL_MEDIA_MANAGER") return { ok: false, status: 403 };
  return { ok: true };
}
