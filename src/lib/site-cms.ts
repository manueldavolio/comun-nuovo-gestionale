/**
 * Costanti e utility condivise del CMS "Sito web".
 * Solo codice client-safe: i guard server sono in `site-cms-server.ts`.
 */

/** Etichette squadre del sito pubblico. */
export const SITE_TEAM_LABELS = {
  PRIMA_SQUADRA: "Prima Squadra",
  FEMMINILE: "Femminile",
  UNDER_19: "Under 19",
  UNDER_17: "Under 17",
  UNDER_15: "Under 15",
  CALCIO_A_5_C2: "Calcio a 5 C2",
} as const;

export type SiteTeamValue = keyof typeof SITE_TEAM_LABELS;

/** Etichette ruoli giocatore. */
export const SITE_PLAYER_ROLE_LABELS = {
  PORTIERE: "Portiere",
  DIFENSORE: "Difensore",
  CENTROCAMPISTA: "Centrocampista",
  ATTACCANTE: "Attaccante",
} as const;

export type SitePlayerRoleValue = keyof typeof SITE_PLAYER_ROLE_LABELS;

/** Etichette categorie sponsor. */
export const SITE_SPONSOR_CATEGORY_LABELS = {
  MAIN: "Main Sponsor",
  GOLD: "Gold Sponsor",
  PARTNER: "Partner",
  TECHNICAL: "Sponsor Tecnico",
} as const;

export type SiteSponsorCategoryValue = keyof typeof SITE_SPONSOR_CATEGORY_LABELS;

/** Categorie staff mostrate sul sito pubblico (devono combaciare col sito). */
export const SITE_STAFF_CATEGORIES = [
  "Dirigenza",
  "Comunicazione",
  "Prima Squadra",
  "Femminile",
  "Under 19",
  "Under 17",
  "Under 15",
  "Attività di Base",
] as const;

/** Categorie news del sito pubblico. */
export const SITE_NEWS_CATEGORIES = [
  "Prima Squadra",
  "Femminile",
  "Attività di Base",
  "Eventi",
  "Società",
] as const;

/** Genera lo slug di una news dal titolo. */
export function slugifyNewsTitle(title: string): string {
  return (
    title
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 96) || "news"
  );
}

/** Estrae l'ID di un video YouTube dai formati URL più comuni. */
export function extractYoutubeId(url: string): string | null {
  const trimmed = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{6,20})/i,
    /(?:youtu\.be\/)([\w-]{6,20})/i,
    /(?:youtube\.com\/embed\/)([\w-]{6,20})/i,
    /(?:youtube\.com\/shorts\/)([\w-]{6,20})/i,
    /(?:youtube\.com\/live\/)([\w-]{6,20})/i,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}
