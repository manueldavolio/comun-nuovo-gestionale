import type {
  SocialAssetKind,
  SocialGraphicFormat,
  SocialGraphicStatus,
  SocialGraphicTemplate,
} from "@prisma/client";

/** Snapshot partita al momento della creazione bozza (non muta Event). */
export type SocialMatchSnapshot = {
  eventId: string;
  startAt: string;
  endAt: string | null;
  title: string;
  type: string;
  typeLabel: string;
  categoryId: string | null;
  categoryName: string;
  opponentName: string | null;
  isHome: boolean | null;
  venueSide: string;
  location: string | null;
  homeScore: number | null;
  awayScore: number | null;
  seasonLabel: string | null;
};

export type SocialGraphicOverrides = {
  headline?: string | null;
  subheadline?: string | null;
  opponentName?: string | null;
  clubDisplayName?: string | null;
  location?: string | null;
  kickoffLabel?: string | null;
  venueSideLabel?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  scorersText?: string | null;
  clubLogoUrl?: string | null;
  opponentLogoUrl?: string | null;
  backgroundUrl?: string | null;
  backgroundColor?: string | null;
  accentColor?: string | null;
  /** Variante estetica A/B per template. */
  styleVariant?: string | null;
};

export type SocialStudioMatchDto = SocialMatchSnapshot;

export type SocialGraphicListItem = {
  id: string;
  title: string;
  template: SocialGraphicTemplate;
  format: SocialGraphicFormat;
  status: SocialGraphicStatus;
  eventId: string | null;
  categoryName: string | null;
  opponentName: string | null;
  matchStartAt: string | null;
  updatedAt: string;
  createdByName: string | null;
  updatedByName: string | null;
};

export type SocialGraphicDetail = SocialGraphicListItem & {
  sourceSnapshot: SocialMatchSnapshot;
  overrides: SocialGraphicOverrides;
  previewPath: string | null;
  exportPath: string | null;
  createdAt: string;
};

export type SocialAssetDto = {
  id: string;
  kind: SocialAssetKind;
  label: string;
  publicUrl: string;
  normalizedKey?: string | null;
  createdAt: string;
};

/** Chiavi vietate nei payload studio (score ammessi; niente atleti/convocazioni). */
export const SOCIAL_STUDIO_FORBIDDEN_KEYS = [
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
  "convocation",
  "attendance",
  "matchPlayerRating",
  "matchPlayerRatings",
  "disciplinaryIncident",
  "possessionScore",
] as const;

function findForbiddenKeys(value: unknown, path = "", found: string[] = []): string[] {
  if (value == null || typeof value !== "object") return found;
  if (value instanceof Date) return found;
  if (Array.isArray(value)) {
    value.forEach((item, i) => findForbiddenKeys(item, `${path}[${i}]`, found));
    return found;
  }
  const forbidden = new Set<string>(SOCIAL_STUDIO_FORBIDDEN_KEYS);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const next = path ? `${path}.${key}` : key;
    if (forbidden.has(key)) found.push(next);
    findForbiddenKeys(nested, next, found);
  }
  return found;
}

export function assertNoSocialStudioPayloadLeak(payload: unknown): void {
  const leaks = findForbiddenKeys(payload);
  if (leaks.length > 0) {
    throw new Error(`Social Studio payload leak: ${leaks.join(", ")}`);
  }
}

export function parseOverrides(value: unknown): SocialGraphicOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : v === null ? null : undefined;
  const str = (v: unknown) => (typeof v === "string" ? v : v === null ? null : undefined);
  return {
    headline: str(raw.headline),
    subheadline: str(raw.subheadline),
    opponentName: str(raw.opponentName),
    clubDisplayName: str(raw.clubDisplayName),
    location: str(raw.location),
    kickoffLabel: str(raw.kickoffLabel),
    venueSideLabel: str(raw.venueSideLabel),
    homeScore: num(raw.homeScore),
    awayScore: num(raw.awayScore),
    scorersText: str(raw.scorersText),
    clubLogoUrl: str(raw.clubLogoUrl),
    opponentLogoUrl: str(raw.opponentLogoUrl),
    backgroundUrl: str(raw.backgroundUrl),
    backgroundColor: str(raw.backgroundColor),
    accentColor: str(raw.accentColor),
    styleVariant: str(raw.styleVariant),
  };
}

export function mergeGraphicView(
  snapshot: SocialMatchSnapshot,
  overrides: SocialGraphicOverrides,
): SocialMatchSnapshot & SocialGraphicOverrides & { resolvedOpponent: string } {
  const opponentName =
    (overrides.opponentName ?? snapshot.opponentName ?? "").trim() ||
    snapshot.title.trim() ||
    "Avversario";
  return {
    ...snapshot,
    ...overrides,
    opponentName,
    location: overrides.location ?? snapshot.location,
    homeScore: overrides.homeScore !== undefined ? overrides.homeScore : snapshot.homeScore,
    awayScore: overrides.awayScore !== undefined ? overrides.awayScore : snapshot.awayScore,
    resolvedOpponent: opponentName,
  };
}
