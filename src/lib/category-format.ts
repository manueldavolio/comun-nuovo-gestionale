/**
 * Formato partita per categoria (5 / 7 / 9 / 11).
 * Fonte primaria: Category.playersPerSide.
 * Fallback legacy solo per sicurezza su record non ancora backfillati.
 */

export const PLAYERS_PER_SIDE_VALUES = [5, 7, 9, 11] as const;

export type PlayersPerSide = (typeof PLAYERS_PER_SIDE_VALUES)[number];

export type CategoryFormatInput = {
  name: string;
  playersPerSide?: number | null;
};

export function isPlayersPerSide(value: unknown): value is PlayersPerSide {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    (PLAYERS_PER_SIDE_VALUES as readonly number[]).includes(value)
  );
}

/**
 * 1) playersPerSide se valorizzato e valido;
 * 2) fallback da prefisso nome (case-insensitive);
 * 3) altrimenti 11.
 */
export function resolvePlayersPerSide(
  category: CategoryFormatInput | string | null | undefined,
): PlayersPerSide {
  if (category == null) return 11;

  if (typeof category !== "string") {
    if (isPlayersPerSide(category.playersPerSide)) {
      return category.playersPerSide;
    }
  }

  const name = (
    typeof category === "string" ? category : category.name ?? ""
  )
    .trim()
    .replace(/\s+/g, " ");

  if (!name) return 11;

  const lower = name.toLowerCase();
  if (lower.startsWith("primi calci")) return 5;
  if (lower.startsWith("pulcini")) return 7;
  if (lower.startsWith("esordienti")) return 9;
  return 11;
}

export function formatPlayersPerSideLabel(playersPerSide: PlayersPerSide): string {
  return `Calcio a ${playersPerSide}`;
}

export const PLAYERS_PER_SIDE_OPTIONS: Array<{
  value: PlayersPerSide;
  label: string;
}> = [
  { value: 5, label: "5 giocatori" },
  { value: 7, label: "7 giocatori" },
  { value: 9, label: "9 giocatori" },
  { value: 11, label: "11 giocatori" },
];
