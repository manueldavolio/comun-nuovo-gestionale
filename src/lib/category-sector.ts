/**
 * Classificazione strutturata Category.sector (E0.1d).
 * Pure helpers — fail-closed per YOUTH_DIRECTOR su FIRST_TEAM e null.
 * Policy eventi: vedi category-event-access-policy.ts / category-event-access.ts.
 */

export const CATEGORY_SECTOR_VALUES = ["YOUTH", "FIRST_TEAM"] as const;

export type CategorySectorValue = (typeof CATEGORY_SECTOR_VALUES)[number];

/** Valore persistito o assenza di classificazione. */
export type CategorySector = CategorySectorValue | null;

export const CATEGORY_SECTOR_LABELS: Record<CategorySectorValue, string> = {
  YOUTH: "Settore giovanile",
  FIRST_TEAM: "Prima Squadra",
};

export function isCategorySectorValue(value: unknown): value is CategorySectorValue {
  return (
    typeof value === "string" &&
    (CATEGORY_SECTOR_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Normalizza input API/DB: YOUTH | FIRST_TEAM | null.
 * Stringhe vuote / undefined / valori sconosciuti → null (non classificata).
 */
export function normalizeCategorySector(value: unknown): CategorySector {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isCategorySectorValue(trimmed)) return trimmed;
  return null;
}

export function isYouthCategorySector(sector: CategorySector): boolean {
  return sector === "YOUTH";
}

export function isFirstTeamCategorySector(sector: CategorySector): boolean {
  return sector === "FIRST_TEAM";
}

export function isUnclassifiedCategorySector(sector: CategorySector): boolean {
  return sector == null;
}

/**
 * YOUTH_DIRECTOR: solo categorie esplicitamente YOUTH.
 * FIRST_TEAM e null sono negate (fail-closed).
 * Non altera ADMIN / COACH / PARENT — usare solo dove lo scope YD è richiesto.
 */
export function canYouthDirectorAccessCategorySector(sector: CategorySector): boolean {
  return isYouthCategorySector(sector);
}

export function categorySectorLabel(sector: CategorySector): string {
  if (sector == null) return "Da classificare";
  return CATEGORY_SECTOR_LABELS[sector];
}
