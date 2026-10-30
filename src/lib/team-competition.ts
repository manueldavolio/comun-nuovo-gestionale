import type { CompetitionSourceType } from "@prisma/client";
import { classifyWeekendCategory } from "@/lib/social-studio/weekend-sectors";

/** Solo host/path ufficiali Tuttocampo Widget — niente ID inventati. */
const TUTTOCAMPO_WIDGET_PREFIXES = [
  "https://www.tuttocampo.it/WidgetV2/",
  "https://www.tuttocampo.it/Widget/",
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

/**
 * Gironi 2026/27 verificati da fonti ufficiali/CRL (non inventati).
 * Widget UUID non inclusi: vanno generati da admin su Tuttocampo dopo login.
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
      "Girone L 2026/27 confermato da Sprint e Sport (07/08/2026) e classifiche CRL Lombardia. Pagina Tuttocampo Classifica Girone L verificata (URL pubblico).",
  },
  {
    categoryNamePattern: /under\s*19|\bu19\b|juniores/i,
    competitionName: "Juniores Under 19 Bergamo",
    groupLabel: "Girone A",
    sourceType: "CRL_LND" as CompetitionSourceType,
    sourcePageUrl: null as string | null,
    verifiedAt: "2026-10-30",
    sourceNotes:
      "Calendario ufficiale CU 9 BG CRL Lombardia 27/08/2026 (Juniores Under 19 Bergamo Girone A). URL Tuttocampo girone non verificato in questa sessione (403 su fetch automatico): usare WidgetApi dopo login oppure aggiornamento manuale.",
  },
  {
    categoryNamePattern: /under\s*17|\bu17\b|allievi/i,
    competitionName: "Allievi Provinciali Under 17 Bergamo",
    groupLabel: "Girone C",
    sourceType: "CRL_LND" as CompetitionSourceType,
    sourcePageUrl: null as string | null,
    verifiedAt: "2026-10-30",
    sourceNotes:
      "Classifica CU 18 BG 15/10/2026 — Allievi Provinc. Under 17 BG Girone C include A.S.D. COMUN NUOVO. Widget Tuttocampo non ancora collegato (ID non inventato).",
  },
  {
    categoryNamePattern: /giovanissimi|under\s*15|\bu15\b/i,
    competitionName: "Giovanissimi Provinciali Under 15 Bergamo",
    groupLabel: "Girone A",
    sourceType: "CRL_LND" as CompetitionSourceType,
    sourcePageUrl: null as string | null,
    verifiedAt: "2026-10-30",
    sourceNotes:
      "Classifica CU 18 BG 15/10/2026 — Giovanissimi Prov. Under 15-BG Girone A include A.S.D. COMUN NUOVO. Widget Tuttocampo non ancora collegato (ID non inventato).",
  },
] as const;

export function isBaseActivityCategory(categoryName: string): boolean {
  const kind = classifyWeekendCategory(categoryName);
  if (kind === "PRIMI_CALCI" || kind === "PULCINI_2017" || kind === "ESORDIENTI") return true;
  return /\b(primi\s*calci|pulcini|esordienti|scuola\s*calcio|gioco\s*sport)\b/i.test(categoryName);
}

export function showsCompetitiveStandings(categoryName: string, sector: string | null): boolean {
  if (isBaseActivityCategory(categoryName)) return false;
  if (sector === "FIRST_TEAM") return true;
  const kind = classifyWeekendCategory(categoryName);
  return kind === "U15" || kind === "U17" || kind === "U19";
}

export function findVerifiedCompetitionHint(categoryName: string) {
  return (
    VERIFIED_2026_27_COMPETITION_HINTS.find((hint) => hint.categoryNamePattern.test(categoryName)) ??
    null
  );
}

export function isAllowedTuttocampoWidgetUrl(raw: string | null | undefined): boolean {
  const value = (raw ?? "").trim();
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname !== "www.tuttocampo.it") return false;
    return TUTTOCAMPO_WIDGET_PREFIXES.some((prefix) => value.startsWith(prefix));
  } catch {
    return false;
  }
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
