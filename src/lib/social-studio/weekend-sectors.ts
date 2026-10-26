import type { SocialGraphicTemplate } from "@prisma/client";

export type WeekendSector = "BASE" | "AGONISTICO";

export type WeekendCategoryKind =
  | "PRIMI_CALCI"
  | "PULCINI_2017"
  | "ESORDIENTI"
  | "U15"
  | "U17"
  | "U19";

export const WEEKEND_SECTOR_META: Record<
  WeekendSector,
  {
    template: SocialGraphicTemplate;
    subtitle: string;
    footerSlogan: string;
    valuesSlogan: string[];
    footerValues?: string[];
    categories: WeekendCategoryKind[];
  }
> = {
  BASE: {
    template: "WEEKEND_BASE",
    subtitle: "ATTIVITÀ DI BASE",
    footerSlogan: "PICCOLI GIOCATORI,\nGRANDI EMOZIONI!",
    valuesSlogan: ["GIOCO", "AMICIZIA", "DIVERTIMENTO", "COMUN NUOVO"],
    categories: ["PRIMI_CALCI", "PULCINI_2017", "ESORDIENTI"],
  },
  AGONISTICO: {
    template: "WEEKEND_AGONISTICO",
    subtitle: "SETTORE AGONISTICA",
    footerSlogan: "STESSI COLORI,\nSTESSA PASSIONE!",
    valuesSlogan: ["IMPEGNO", "CRESCITA", "PASSIONE", "COMUN NUOVO"],
    footerValues: ["RISPETTO", "SQUADRA", "IMPEGNO", "CRESCITA"],
    categories: ["U15", "U17", "U19"],
  },
};

const CATEGORY_ORDER: Record<WeekendCategoryKind, number> = {
  PRIMI_CALCI: 10,
  PULCINI_2017: 20,
  ESORDIENTI: 30,
  U15: 40,
  U17: 50,
  U19: 60,
};

export function isWeekendTemplate(
  template: SocialGraphicTemplate | string,
): template is "WEEKEND_BASE" | "WEEKEND_AGONISTICO" {
  return template === "WEEKEND_BASE" || template === "WEEKEND_AGONISTICO";
}

export function sectorFromTemplate(
  template: SocialGraphicTemplate | string,
): WeekendSector | null {
  if (template === "WEEKEND_BASE") return "BASE";
  if (template === "WEEKEND_AGONISTICO") return "AGONISTICO";
  return null;
}

export function templateFromSector(sector: WeekendSector): SocialGraphicTemplate {
  return WEEKEND_SECTOR_META[sector].template;
}

function normalizeCategoryName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Classifica una categoria del calendario nei bucket delle locandine.
 * Pulcini: solo 2017. Esordienti BASE: senza U15/Under. Agonistica: U15/U17/U19.
 */
export function classifyWeekendCategory(categoryName: string): WeekendCategoryKind | null {
  const name = normalizeCategoryName(categoryName);
  if (!name) return null;

  if (/^primi\s*calci/.test(name)) return "PRIMI_CALCI";

  if (/pulcini/.test(name)) {
    return /\b2017\b/.test(name) ? "PULCINI_2017" : null;
  }

  if (/\bu\s*19\b|under\s*19|juniores/.test(name)) return "U19";
  if (/\bu\s*17\b|under\s*17/.test(name)) return "U17";
  if (/\bu\s*15\b|under\s*15|giovanissimi/.test(name)) return "U15";
  if (/esordienti/.test(name) && /\bu\s*15\b|under\s*15/.test(name)) return "U15";

  if (/^esordienti\b/.test(name) && !/\bu\s*\d|under\s*\d/.test(name)) {
    return "ESORDIENTI";
  }

  return null;
}

export function displayCategoryLabel(kind: WeekendCategoryKind): string {
  switch (kind) {
    case "PRIMI_CALCI":
      return "PRIMI CALCI";
    case "PULCINI_2017":
      return "PULCINI 2017";
    case "ESORDIENTI":
      return "ESORDIENTI";
    case "U15":
      return "U15";
    case "U17":
      return "U17";
    case "U19":
      return "U19";
  }
}

export function categorySortKey(kind: WeekendCategoryKind): number {
  return CATEGORY_ORDER[kind];
}

export function categoryMatchesSector(
  categoryName: string,
  sector: WeekendSector,
): boolean {
  const kind = classifyWeekendCategory(categoryName);
  if (!kind) return false;
  return WEEKEND_SECTOR_META[sector].categories.includes(kind);
}

/** Sabato–domenica della settimana di `ref` (dom = weekend corrente, lun–ven = weekend in arrivo). */
export function weekendBoundsContaining(ref: Date): { start: Date; end: Date } {
  const day = ref.getUTCDay(); // 0=dom … 6=sab
  const offsetToSaturday = day === 0 ? -1 : day === 6 ? 0 : 6 - day;
  const start = new Date(
    Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate() + offsetToSaturday, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1, 23, 59, 59, 999),
  );
  return { start, end };
}

export function parseDateOnlyUtc(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

export function endOfDayUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999),
  );
}

export function formatWeekendBannerLabel(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear();
  const dayStart = String(start.getUTCDate()).padStart(2, "0");
  const dayEnd = String(end.getUTCDate()).padStart(2, "0");
  const monthYear = new Intl.DateTimeFormat("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(end);
  if (sameMonth) {
    return `WEEKEND ${dayStart} - ${dayEnd} ${monthYear}`.toUpperCase();
  }
  const startLabel = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(end);
  return `WEEKEND ${startLabel} - ${endLabel}`.toUpperCase();
}

export function formatMatchDayLabel(iso: string): string {
  const date = new Date(iso);
  const weekday = new Intl.DateTimeFormat("it-IT", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "")
    .toUpperCase();
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${weekday} ${day}/${month}`;
}

export function formatMatchTimeLabel(iso: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

/** Se opponentName manca, prova a ricavarlo dal titolo Event (es. "Amichevole vs Almè"). */
export function resolveOpponentDisplayName(
  opponentName: string | null | undefined,
  title: string | null | undefined,
): string {
  const direct = (opponentName ?? "").trim();
  if (direct) return direct;
  const rawTitle = (title ?? "").trim();
  if (!rawTitle) return "Avversario";
  const vs = rawTitle.match(/\bvs\.?\s+(.+)$/i);
  if (vs?.[1]) return vs[1].replace(/\s*\(.*\)\s*$/, "").trim() || rawTitle;
  return rawTitle;
}

/**
 * Etichetta luogo per la locandina.
 * - CASA/TRASFERTA solo se isHome è noto (mai inventato).
 * - venueLabel = solo location ufficiale del calendario (mai l'indirizzo istituzionale del footer).
 * - Nessun "SEDE N/D" in grafica.
 */
export function formatWeekendVenueLabel(input: {
  isHome: boolean | null;
  location: string | null;
}): { venueSideLabel: string; venueLabel: string } {
  const loc = (input.location ?? "").trim();
  if (input.isHome === false) {
    return { venueSideLabel: "TRASFERTA", venueLabel: loc };
  }
  if (input.isHome === true) {
    return { venueSideLabel: "CASA", venueLabel: loc };
  }
  return { venueSideLabel: "", venueLabel: loc };
}
