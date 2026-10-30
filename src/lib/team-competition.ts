import type { CompetitionSourceType } from "@prisma/client";
import { classifyWeekendCategory } from "@/lib/social-studio/weekend-sectors";

export const TUTTOCAMPO_WIDGET_HOST = "https://www.tuttocampo.it";
export const TUTTOCAMPO_WIDGET_V2_PREFIX = `${TUTTOCAMPO_WIDGET_HOST}/WidgetV2/` as const;

export const TUTTOCAMPO_WIDGET_KINDS = [
  "Risultati",
  "Classifica",
  "Marcatori",
  "Partita",
  "ProssimaPartita",
] as const;

export type TuttocampoWidgetKind = (typeof TUTTOCAMPO_WIDGET_KINDS)[number];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Stagione widget Tuttocampo (?y=AAAA-AA). */
const WIDGET_SEASON_RE = /^\d{4}-\d{2}$/;

/**
 * UUID ufficiale Esordienti (confermato dal club).
 * Da associare SOLO alla categoria Esordienti 2026/27, salvo scelta admin esplicita di condivisione.
 */
export const ESORDIENTI_TUTTOCAMPO_WIDGET_UUID = "99f6f12c-cb8c-4119-a461-2cb01911ca55";

/** @deprecated alias — usare ESORDIENTI_TUTTOCAMPO_WIDGET_UUID */
export const PROVIDED_TUTTOCAMPO_WIDGET_UUID = ESORDIENTI_TUTTOCAMPO_WIDGET_UUID;

export const ESORDIENTI_TUTTOCAMPO_WIDGET = {
  uuid: ESORDIENTI_TUTTOCAMPO_WIDGET_UUID,
  categoryHint: "Esordienti",
  seasonLabelHint: "2026/2027",
  widgetSeasonParam: "2026-27",
  inspectedAt: "2026-10-30",
  note:
    "UUID Esordienti: in area genitori mostra risultati/ultima/prossima partita; classifica e marcatori restano nascosti (attività di base).",
} as const;

/** @deprecated alias */
export const PROVIDED_TUTTOCAMPO_WIDGET_INSPECTION = ESORDIENTI_TUTTOCAMPO_WIDGET;

/** Slot admin: ogni categoria competitiva/base ha UUID proprio (da compilare in Fonti). */
export const TUTTOCAMPO_CATEGORY_UUID_SLOTS = [
  { key: "ESORDIENTI", label: "Esordienti", uuidKnown: ESORDIENTI_TUTTOCAMPO_WIDGET_UUID },
  { key: "U15", label: "Giovanissimi U15", uuidKnown: null },
  { key: "U17", label: "Allievi U17", uuidKnown: null },
  { key: "U19", label: "Juniores U19", uuidKnown: null },
  { key: "PRIMA", label: "Prima squadra", uuidKnown: null },
] as const;

export type ManualStandingRow = {
  pos: number;
  team: string;
  points: number;
  played?: number;
  won?: number;
  drawn?: number;
  lost?: number;
  gf?: number;
  ga?: number;
};

export type TuttocampoWidgetUrls = {
  results: string;
  standings: string;
  scorers: string;
  lastMatch: string;
  nextMatch: string;
};

/**
 * Gironi 2026/27 verificati da fonti ufficiali/CRL (non inventati).
 * Widget UUID non inclusiti come auto-link: vanno confermati da admin.
 * Aggiornato: 2026-10-30.
 */
export const VERIFIED_2026_27_COMPETITION_HINTS = [
  {
    categoryNamePattern: /prima\s*squadra/i,
    competitionName: "Prima Categoria Lombardia",
    groupLabel: "Girone L",
    sourceType: "TUTTOCAMPO" as CompetitionSourceType,
    sourcePageUrl: "https://www.tuttocampo.it/Lombardia/PrimaCategoria/GironeL/Classifica",
    verifiedAt: "2026-10-30",
    sourceNotes:
      "Girone L 2026/27 confermato da Sprint e Sport (07/08/2026) e CU CRL. UUID Tuttocampo Prima squadra da inserire in admin (diverso da Esordienti).",
  },
  {
    categoryNamePattern: /\besordienti\b/i,
    competitionName: "Esordienti",
    groupLabel: null as string | null,
    sourceType: "TUTTOCAMPO" as CompetitionSourceType,
    sourcePageUrl: null as string | null,
    verifiedAt: "2026-10-30",
    sourceNotes:
      "UUID ufficiale Esordienti 99f6f12c-cb8c-4119-a461-2cb01911ca55 (stagione widget 2026-27). In genitori: risultati/partite sì; classifica/marcatori no.",
  },
  {
    categoryNamePattern: /under\s*19|\bu19\b|juniores/i,
    competitionName: "Juniores Under 19 Bergamo",
    groupLabel: "Girone A",
    sourceType: "CRL_LND" as CompetitionSourceType,
    sourcePageUrl: null as string | null,
    verifiedAt: "2026-10-30",
    sourceNotes:
      "Calendario ufficiale CU 9 BG CRL Lombardia 27/08/2026 (Juniores Under 19 Bergamo Girone A). URL Tuttocampo girone non verificato in questa sessione.",
  },
  {
    categoryNamePattern: /under\s*17|\bu17\b|allievi/i,
    competitionName: "Allievi Provinciali Under 17 Bergamo",
    groupLabel: "Girone C",
    sourceType: "CRL_LND" as CompetitionSourceType,
    sourcePageUrl: null as string | null,
    verifiedAt: "2026-10-30",
    sourceNotes:
      "Classifica CU 18 BG 15/10/2026 — Allievi Provinc. Under 17 BG Girone C include A.S.D. COMUN NUOVO.",
  },
  {
    categoryNamePattern: /giovanissimi|under\s*15|\bu15\b/i,
    competitionName: "Giovanissimi Provinciali Under 15 Bergamo",
    groupLabel: "Girone A",
    sourceType: "CRL_LND" as CompetitionSourceType,
    sourcePageUrl: null as string | null,
    verifiedAt: "2026-10-30",
    sourceNotes:
      "Classifica CU 18 BG 15/10/2026 — Giovanissimi Prov. Under 15-BG Girone A include A.S.D. COMUN NUOVO.",
  },
] as const;

export function isBaseActivityCategory(categoryName: string): boolean {
  const kind = classifyWeekendCategory(categoryName);
  if (kind === "PRIMI_CALCI" || kind === "PULCINI_2017" || kind === "ESORDIENTI") return true;
  return /\b(primi\s*calci|pulcini|esordienti|scuola\s*calcio|gioco\s*sport)\b/i.test(categoryName);
}

export function isEsordientiCategory(categoryName: string): boolean {
  const kind = classifyWeekendCategory(categoryName);
  if (kind === "ESORDIENTI") return true;
  return /\besordienti\b/i.test(categoryName);
}

/** Classifica / marcatori: solo categorie agonistiche (non attività di base). */
export function showsCompetitiveStandings(categoryName: string, sector: string | null): boolean {
  if (isBaseActivityCategory(categoryName)) return false;
  if (sector === "FIRST_TEAM") return true;
  const kind = classifyWeekendCategory(categoryName);
  return kind === "U15" || kind === "U17" || kind === "U19";
}

/** Risultati / ultima / prossima: anche Esordienti e altre base se configurati. */
export function showsMatchResultWidgets(categoryName: string): boolean {
  return Boolean(categoryName?.trim());
}

export type ResolvedWidgetUrls = {
  standings: string | null;
  results: string | null;
  scorers: string | null;
  lastMatch: string | null;
  nextMatch: string | null;
};

/** Applica policy UI: nasconde classifica/marcatori per attività di base. */
export function filterWidgetsByCategoryPolicy(
  widgets: ResolvedWidgetUrls,
  categoryName: string,
  sector: string | null,
): ResolvedWidgetUrls {
  if (showsCompetitiveStandings(categoryName, sector)) return widgets;
  return {
    ...widgets,
    standings: null,
    scorers: null,
  };
}

export function hasVisibleTuttocampoWidgets(widgets: ResolvedWidgetUrls | null | undefined): boolean {
  if (!widgets) return false;
  return Boolean(
    widgets.nextMatch ||
      widgets.lastMatch ||
      widgets.results ||
      widgets.standings ||
      widgets.scorers,
  );
}

export function findVerifiedCompetitionHint(categoryName: string) {
  return (
    VERIFIED_2026_27_COMPETITION_HINTS.find((hint) => hint.categoryNamePattern.test(categoryName)) ??
    null
  );
}

export function isValidTuttocampoWidgetUuid(raw: string | null | undefined): boolean {
  const value = (raw ?? "").trim();
  return UUID_RE.test(value);
}

export function normalizeWidgetSeasonParam(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (!WIDGET_SEASON_RE.test(value)) return null;
  return value;
}

/** Converte etichetta gestionale "2026/2027" → "2026-27" se possibile. */
export function seasonLabelToWidgetParam(seasonLabel: string | null | undefined): string | null {
  const value = (seasonLabel ?? "").trim();
  const match = value.match(/^(\d{4})\s*[\/\-]\s*(\d{2}|\d{4})$/);
  if (!match) return null;
  const start = match[1];
  const endRaw = match[2];
  const end = endRaw.length === 4 ? endRaw.slice(2) : endRaw;
  return normalizeWidgetSeasonParam(`${start}-${end}`);
}

export function buildTuttocampoWidgetUrl(
  kind: TuttocampoWidgetKind,
  uuid: string,
  seasonParam?: string | null,
): string {
  const id = uuid.trim();
  if (!isValidTuttocampoWidgetUuid(id)) {
    throw new Error("UUID Tuttocampo non valido.");
  }
  const season = normalizeWidgetSeasonParam(seasonParam);
  const base = `${TUTTOCAMPO_WIDGET_V2_PREFIX}${kind}/${id}`;
  return season ? `${base}?y=${season}` : base;
}

export function buildTuttocampoWidgetUrls(
  uuid: string,
  seasonParam?: string | null,
): TuttocampoWidgetUrls {
  return {
    results: buildTuttocampoWidgetUrl("Risultati", uuid, seasonParam),
    standings: buildTuttocampoWidgetUrl("Classifica", uuid, seasonParam),
    scorers: buildTuttocampoWidgetUrl("Marcatori", uuid, seasonParam),
    lastMatch: buildTuttocampoWidgetUrl("Partita", uuid, seasonParam),
    nextMatch: buildTuttocampoWidgetUrl("ProssimaPartita", uuid, seasonParam),
  };
}

export function parseTuttocampoWidgetUrl(raw: string | null | undefined): {
  kind: TuttocampoWidgetKind;
  uuid: string;
  seasonParam: string | null;
} | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "www.tuttocampo.it") return null;
    const match = url.pathname.match(
      /^\/WidgetV2\/(Risultati|Classifica|Marcatori|Partita|ProssimaPartita)\/([0-9a-f-]{36})$/i,
    );
    if (!match) return null;
    const kind = match[1] as TuttocampoWidgetKind;
    const uuid = match[2];
    if (!isValidTuttocampoWidgetUuid(uuid)) return null;
    if (!(TUTTOCAMPO_WIDGET_KINDS as readonly string[]).includes(kind)) return null;
    const y = url.searchParams.get("y");
    const seasonParam = y ? normalizeWidgetSeasonParam(y) : null;
    if (y && !seasonParam) return null;
    return { kind, uuid, seasonParam };
  } catch {
    return null;
  }
}

/** Solo WidgetV2 con tipo consentito + UUID valido (+ ?y= opzionale). */
export function isAllowedTuttocampoWidgetUrl(raw: string | null | undefined): boolean {
  const value = (raw ?? "").trim();
  if (!value) return true;
  return parseTuttocampoWidgetUrl(value) !== null;
}

export function resolveCompetitionWidgetUrls(source: {
  tuttocampoWidgetUuid?: string | null;
  widgetSeasonParam?: string | null;
  widgetStandingsUrl?: string | null;
  widgetResultsUrl?: string | null;
  widgetScorersUrl?: string | null;
  widgetLastMatchUrl?: string | null;
  widgetNextMatchUrl?: string | null;
}): ResolvedWidgetUrls {
  const uuid = (source.tuttocampoWidgetUuid ?? "").trim();
  if (isValidTuttocampoWidgetUuid(uuid)) {
    const built = buildTuttocampoWidgetUrls(uuid, source.widgetSeasonParam);
    return {
      standings: built.standings,
      results: built.results,
      scorers: built.scorers,
      lastMatch: built.lastMatch,
      nextMatch: built.nextMatch,
    };
  }
  return {
    standings: isAllowedTuttocampoWidgetUrl(source.widgetStandingsUrl)
      ? (source.widgetStandingsUrl?.trim() || null)
      : null,
    results: isAllowedTuttocampoWidgetUrl(source.widgetResultsUrl)
      ? (source.widgetResultsUrl?.trim() || null)
      : null,
    scorers: isAllowedTuttocampoWidgetUrl(source.widgetScorersUrl)
      ? (source.widgetScorersUrl?.trim() || null)
      : null,
    lastMatch: isAllowedTuttocampoWidgetUrl(source.widgetLastMatchUrl)
      ? (source.widgetLastMatchUrl?.trim() || null)
      : null,
    nextMatch: isAllowedTuttocampoWidgetUrl(source.widgetNextMatchUrl)
      ? (source.widgetNextMatchUrl?.trim() || null)
      : null,
  };
}

export function parseManualStandingsJson(raw: string | null | undefined): ManualStandingRow[] | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const rows: ManualStandingRow[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const pos = Number(row.pos);
      const points = Number(row.points);
      const team = typeof row.team === "string" ? row.team.trim() : "";
      if (!Number.isFinite(pos) || !Number.isFinite(points) || !team) return null;
      rows.push({
        pos,
        team,
        points,
        played: row.played != null ? Number(row.played) : undefined,
        won: row.won != null ? Number(row.won) : undefined,
        drawn: row.drawn != null ? Number(row.drawn) : undefined,
        lost: row.lost != null ? Number(row.lost) : undefined,
        gf: row.gf != null ? Number(row.gf) : undefined,
        ga: row.ga != null ? Number(row.ga) : undefined,
      });
    }
    return rows.sort((a, b) => a.pos - b.pos);
  } catch {
    return null;
  }
}

export function sourceTypeLabel(type: CompetitionSourceType): string {
  switch (type) {
    case "TUTTOCAMPO":
      return "Tuttocampo";
    case "CRL_LND":
      return "CRL / LND";
    case "MANUAL":
      return "Aggiornamento manuale";
    default:
      return "Non configurata";
  }
}
