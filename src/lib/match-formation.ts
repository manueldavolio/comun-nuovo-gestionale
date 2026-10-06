/**
 * C2 — Formazione partita privata (logica pura).
 * Sempre staff-only. Nessuna pubblicazione ai genitori.
 * Moduli filtrati per Category.playersPerSide (5/7/9/11).
 */

import {
  formatPlayersPerSideLabel,
  isPlayersPerSide,
  type PlayersPerSide,
} from "@/lib/category-format";
import { isMatchEventType } from "@/lib/parent-season";

export const FORMATION_MODULE_IDS = [
  // 5v5
  "1-2-1",
  "2-1-1",
  "1-1-2",
  // 7v7
  "2-3-1",
  "3-2-1",
  "2-2-2",
  // 9v9
  "3-3-2",
  "3-2-3",
  "2-3-3",
  // 11v11
  "4-3-3",
  "4-4-2",
  "4-2-3-1",
  "3-5-2",
  "3-4-3",
  "CUSTOM",
] as const;

export type FormationModuleId = (typeof FORMATION_MODULE_IDS)[number];

export type FormationLineRole = "GK" | "DEF" | "MID" | "AM" | "FWD";

export type FormationLineDef = {
  role: FormationLineRole;
  label: string;
  count: number;
};

export type FormationSlotTemplate = {
  slotKey: string;
  lineRole: FormationLineRole | "CUSTOM";
  lineLabel: string;
  isBench: false;
  sortOrder: number;
};

const MODULE_LINES: Record<Exclude<FormationModuleId, "CUSTOM">, FormationLineDef[]> = {
  // 5v5 (POR compreso)
  "1-2-1": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 1 },
    { role: "MID", label: "Centrocampo", count: 2 },
    { role: "FWD", label: "Attacco", count: 1 },
  ],
  "2-1-1": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 2 },
    { role: "MID", label: "Centrocampo", count: 1 },
    { role: "FWD", label: "Attacco", count: 1 },
  ],
  "1-1-2": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 1 },
    { role: "MID", label: "Centrocampo", count: 1 },
    { role: "FWD", label: "Attacco", count: 2 },
  ],
  // 7v7
  "2-3-1": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 2 },
    { role: "MID", label: "Centrocampo", count: 3 },
    { role: "FWD", label: "Attacco", count: 1 },
  ],
  "3-2-1": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 3 },
    { role: "MID", label: "Centrocampo", count: 2 },
    { role: "FWD", label: "Attacco", count: 1 },
  ],
  "2-2-2": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 2 },
    { role: "MID", label: "Centrocampo", count: 2 },
    { role: "FWD", label: "Attacco", count: 2 },
  ],
  // 9v9
  "3-3-2": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 3 },
    { role: "MID", label: "Centrocampo", count: 3 },
    { role: "FWD", label: "Attacco", count: 2 },
  ],
  "3-2-3": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 3 },
    { role: "MID", label: "Centrocampo", count: 2 },
    { role: "FWD", label: "Attacco", count: 3 },
  ],
  "2-3-3": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 2 },
    { role: "MID", label: "Centrocampo", count: 3 },
    { role: "FWD", label: "Attacco", count: 3 },
  ],
  // 11v11
  "4-3-3": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 4 },
    { role: "MID", label: "Centrocampo", count: 3 },
    { role: "FWD", label: "Attacco", count: 3 },
  ],
  "4-4-2": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 4 },
    { role: "MID", label: "Centrocampo", count: 4 },
    { role: "FWD", label: "Attacco", count: 2 },
  ],
  "4-2-3-1": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 4 },
    { role: "MID", label: "Medianì", count: 2 },
    { role: "AM", label: "Trequartisti", count: 3 },
    { role: "FWD", label: "Attacco", count: 1 },
  ],
  "3-5-2": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 3 },
    { role: "MID", label: "Centrocampo", count: 5 },
    { role: "FWD", label: "Attacco", count: 2 },
  ],
  "3-4-3": [
    { role: "GK", label: "Portiere", count: 1 },
    { role: "DEF", label: "Difesa", count: 3 },
    { role: "MID", label: "Centrocampo", count: 4 },
    { role: "FWD", label: "Attacco", count: 3 },
  ],
};

const MODULES_BY_FORMAT: Record<PlayersPerSide, FormationModuleId[]> = {
  5: ["1-2-1", "2-1-1", "1-1-2", "CUSTOM"],
  7: ["2-3-1", "3-2-1", "2-2-2", "CUSTOM"],
  9: ["3-3-2", "3-2-3", "2-3-3", "CUSTOM"],
  11: ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "CUSTOM"],
};

const ROLE_PREFIX: Record<FormationLineRole, string> = {
  GK: "POR",
  DEF: "DF",
  MID: "MF",
  AM: "AM",
  FWD: "FW",
};

export function isFormationModuleId(value: unknown): value is FormationModuleId {
  return (
    typeof value === "string" &&
    (FORMATION_MODULE_IDS as readonly string[]).includes(value)
  );
}

export function isMatchFormationEventType(type: string): boolean {
  return isMatchEventType(type);
}

export function modulesForPlayersPerSide(
  playersPerSide: PlayersPerSide,
): FormationModuleId[] {
  return [...MODULES_BY_FORMAT[playersPerSide]];
}

export function isModuleCompatibleWithPlayersPerSide(
  module: FormationModuleId,
  playersPerSide: PlayersPerSide,
): boolean {
  return MODULES_BY_FORMAT[playersPerSide].includes(module);
}

export function defaultModuleForPlayersPerSide(
  playersPerSide: PlayersPerSide,
): Exclude<FormationModuleId, "CUSTOM"> {
  const first = MODULES_BY_FORMAT[playersPerSide].find((m) => m !== "CUSTOM");
  return (first ?? "4-3-3") as Exclude<FormationModuleId, "CUSTOM">;
}

export function getModuleLines(moduleId: FormationModuleId): FormationLineDef[] {
  if (moduleId === "CUSTOM") return [];
  return MODULE_LINES[moduleId];
}

export function starterCountForModule(moduleId: FormationModuleId): number {
  if (moduleId === "CUSTOM") return 0;
  return MODULE_LINES[moduleId].reduce((sum, line) => sum + line.count, 0);
}

export function buildStarterSlotsForModule(
  moduleId: Exclude<FormationModuleId, "CUSTOM">,
): FormationSlotTemplate[] {
  const lines = MODULE_LINES[moduleId];
  const slots: FormationSlotTemplate[] = [];
  let sortOrder = 0;
  for (const line of lines) {
    for (let i = 1; i <= line.count; i++) {
      const prefix = ROLE_PREFIX[line.role];
      const slotKey = line.role === "GK" ? "POR" : `${prefix}${i}`;
      slots.push({
        slotKey,
        lineRole: line.role,
        lineLabel: line.label,
        isBench: false,
        sortOrder: sortOrder++,
      });
    }
  }
  return slots;
}

export function expectedStarterSlotKeys(
  moduleId: Exclude<FormationModuleId, "CUSTOM">,
): string[] {
  return buildStarterSlotsForModule(moduleId).map((s) => s.slotKey);
}

export function isBenchSlotKey(slotKey: string): boolean {
  return /^BENCH_\d+$/.test(slotKey);
}

export function isCustomStarterSlotKey(slotKey: string): boolean {
  return /^CUSTOM_\d+$/.test(slotKey);
}

export function nextBenchSlotKey(existingKeys: string[]): string {
  let max = 0;
  for (const key of existingKeys) {
    const m = /^BENCH_(\d+)$/.exec(key);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `BENCH_${max + 1}`;
}

export function nextCustomStarterSlotKey(existingKeys: string[]): string {
  let max = 0;
  for (const key of existingKeys) {
    const m = /^CUSTOM_(\d+)$/.exec(key);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `CUSTOM_${max + 1}`;
}

export function emptyCustomStarterSlots(playersPerSide: PlayersPerSide): Array<{
  slotKey: string;
  athleteId: null;
  isBench: false;
}> {
  return Array.from({ length: playersPerSide }, (_, i) => ({
    slotKey: `CUSTOM_${i + 1}`,
    athleteId: null,
    isBench: false as const,
  }));
}

export type FormationSlotInput = {
  slotKey: string;
  athleteId: string | null;
  isBench: boolean;
  sortOrder: number;
};

export type ValidateFormationSlotsResult =
  | { ok: true; slots: FormationSlotInput[] }
  | { ok: false; error: string };

/**
 * Valida slot per formato categoria.
 * Panchina esclusa dal conteggio playersPerSide.
 * CUSTOM: esattamente playersPerSide titolari al salvataggio.
 */
export function validateFormationSlots(params: {
  module: FormationModuleId;
  playersPerSide: PlayersPerSide;
  slots: Array<{
    slotKey: unknown;
    athleteId?: unknown;
    isBench?: unknown;
    sortOrder?: unknown;
  }>;
  allowedAthleteIds: Set<string>;
}): ValidateFormationSlotsResult {
  const { module, playersPerSide, allowedAthleteIds } = params;

  if (!isPlayersPerSide(playersPerSide)) {
    return { ok: false, error: "Formato categoria non valido." };
  }

  if (!isModuleCompatibleWithPlayersPerSide(module, playersPerSide)) {
    return {
      ok: false,
      error: `Il modulo ${module} non è compatibile con ${formatPlayersPerSideLabel(playersPerSide)}.`,
    };
  }

  if (!Array.isArray(params.slots)) {
    return { ok: false, error: "Slot non validi." };
  }
  if (params.slots.length > 40) {
    return { ok: false, error: "Troppi slot." };
  }

  const normalized: FormationSlotInput[] = [];
  const seenKeys = new Set<string>();
  const seenAthletes = new Set<string>();

  for (let i = 0; i < params.slots.length; i++) {
    const row = params.slots[i]!;
    if (typeof row.slotKey !== "string" || !row.slotKey.trim()) {
      return { ok: false, error: `Slot ${i + 1}: chiave non valida.` };
    }
    const slotKey = row.slotKey.trim();
    if (seenKeys.has(slotKey)) {
      return { ok: false, error: `Slot duplicato: ${slotKey}.` };
    }
    seenKeys.add(slotKey);

    const isBench =
      typeof row.isBench === "boolean" ? row.isBench : isBenchSlotKey(slotKey);
    if (isBench && !isBenchSlotKey(slotKey)) {
      return { ok: false, error: `Chiave panchina non valida: ${slotKey}.` };
    }
    if (!isBench && module === "CUSTOM" && !isCustomStarterSlotKey(slotKey)) {
      return { ok: false, error: `Slot personalizzato non valido: ${slotKey}.` };
    }

    let athleteId: string | null = null;
    if (row.athleteId != null && row.athleteId !== "") {
      if (typeof row.athleteId !== "string") {
        return { ok: false, error: `Slot ${slotKey}: atleta non valido.` };
      }
      athleteId = row.athleteId;
      if (!allowedAthleteIds.has(athleteId)) {
        return {
          ok: false,
          error: `Atleta non consentito per lo slot ${slotKey}.`,
        };
      }
      if (seenAthletes.has(athleteId)) {
        return {
          ok: false,
          error: "Lo stesso giocatore non può occupare due slot.",
        };
      }
      seenAthletes.add(athleteId);
    }

    const sortOrder =
      typeof row.sortOrder === "number" && Number.isInteger(row.sortOrder)
        ? row.sortOrder
        : i;

    normalized.push({
      slotKey,
      athleteId,
      isBench: isBench || isBenchSlotKey(slotKey),
      sortOrder,
    });
  }

  const starters = normalized.filter((s) => !s.isBench);

  if (module === "CUSTOM") {
    if (starters.length !== playersPerSide) {
      return {
        ok: false,
        error: `${formatPlayersPerSideLabel(playersPerSide)}: servono esattamente ${playersPerSide} titolari (panchina esclusa). Ora: ${starters.length}.`,
      };
    }
  } else {
    const expected = expectedStarterSlotKeys(module);
    const starterKeys = starters.map((s) => s.slotKey);
    const starterSet = new Set(starterKeys);
    if (starters.length !== expected.length || expected.length !== playersPerSide) {
      return {
        ok: false,
        error: `Il modulo ${module} richiede ${expected.length} titolari.`,
      };
    }
    for (const key of expected) {
      if (!starterSet.has(key)) {
        return { ok: false, error: `Manca lo slot ${key} per il modulo ${module}.` };
      }
    }
    for (const key of starterKeys) {
      if (!expected.includes(key)) {
        return { ok: false, error: `Slot ${key} non previsto dal modulo ${module}.` };
      }
    }
  }

  const withOrder = normalized.map((slot, index) => ({
    ...slot,
    sortOrder: index,
  }));

  return { ok: true, slots: withOrder };
}

export function athleteNotInConvocationWarning(
  athleteId: string | null,
  convocatedIds: Set<string>,
): string | null {
  if (!athleteId) return null;
  if (convocatedIds.size === 0) return null;
  if (convocatedIds.has(athleteId)) return null;
  return "Questo atleta non risulta nella convocazione.";
}

export function groupSlotsByLine(
  module: FormationModuleId,
  slots: Array<{ slotKey: string; isBench: boolean; athleteId: string | null }>,
): Array<{
  label: string;
  role: FormationLineRole | "CUSTOM" | "BENCH";
  slots: Array<{ slotKey: string; athleteId: string | null }>;
}> {
  const starters = slots.filter((s) => !s.isBench);
  const bench = slots.filter((s) => s.isBench);

  if (module === "CUSTOM") {
    return [
      {
        label: "Titolari",
        role: "CUSTOM",
        slots: starters.map((s) => ({ slotKey: s.slotKey, athleteId: s.athleteId })),
      },
      {
        label: "Panchina",
        role: "BENCH",
        slots: bench.map((s) => ({ slotKey: s.slotKey, athleteId: s.athleteId })),
      },
    ];
  }

  const lines = getModuleLines(module);
  const groups: Array<{
    label: string;
    role: FormationLineRole | "CUSTOM" | "BENCH";
    slots: Array<{ slotKey: string; athleteId: string | null }>;
  }> = [];

  for (const line of lines) {
    const prefix = ROLE_PREFIX[line.role];
    const lineSlots = starters.filter((s) =>
      line.role === "GK" ? s.slotKey === "POR" : s.slotKey.startsWith(prefix),
    );
    groups.push({
      label: line.label,
      role: line.role,
      slots: lineSlots.map((s) => ({ slotKey: s.slotKey, athleteId: s.athleteId })),
    });
  }

  groups.push({
    label: "Panchina",
    role: "BENCH",
    slots: bench.map((s) => ({ slotKey: s.slotKey, athleteId: s.athleteId })),
  });

  return groups;
}

/** Layout pitch: linee dall'attacco al portiere (top → bottom). */
export function pitchLinesForModule(
  module: FormationModuleId,
): Array<{ role: FormationLineRole | "CUSTOM"; label: string; slotKeys: string[] }> {
  if (module === "CUSTOM") {
    return [];
  }
  const slots = buildStarterSlotsForModule(module);
  const lines = getModuleLines(module);
  const visualOrder: FormationLineRole[] = ["FWD", "AM", "MID", "DEF", "GK"];
  const result: Array<{
    role: FormationLineRole | "CUSTOM";
    label: string;
    slotKeys: string[];
  }> = [];
  for (const role of visualOrder) {
    const line = lines.find((l) => l.role === role);
    if (!line) continue;
    const slotKeys = slots.filter((s) => s.lineRole === role).map((s) => s.slotKey);
    result.push({ role, label: line.label, slotKeys });
  }
  return result;
}

export function formationModuleOptionsForPlayersPerSide(
  playersPerSide: PlayersPerSide,
): Array<{ value: FormationModuleId; label: string }> {
  return modulesForPlayersPerSide(playersPerSide).map((value) => ({
    value,
    label: value === "CUSTOM" ? "Personalizzata" : value,
  }));
}

/** @deprecated Prefer formationModuleOptionsForPlayersPerSide */
export const FORMATION_MODULE_OPTIONS: Array<{
  value: FormationModuleId;
  label: string;
}> = formationModuleOptionsForPlayersPerSide(11);
