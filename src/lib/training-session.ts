/**
 * C1 — Programma allenamento + libreria esercizi (logica pura).
 * TrainingExercise = template; TrainingSessionItem = snapshot seduta.
 */

export const TRAINING_TITLE_MAX = 120;
export const TRAINING_DESCRIPTION_MAX = 2000;
export const TRAINING_MATERIALS_MAX = 400;
export const TRAINING_NOTES_MAX = 500;
export const TRAINING_DURATION_MAX = 300;
export const TRAINING_SESSION_ITEMS_MAX = 40;

export type TrainingItemInput = {
  id?: string;
  exerciseId?: string | null;
  title: string;
  description?: string | null;
  durationMin?: number | null;
  sortOrder: number;
};

export type TrainingExerciseSnapshotSource = {
  id: string;
  title: string;
  description: string | null;
  durationMin: number | null;
};

export function normalizeTrainingTitle(raw: unknown):
  | { ok: true; title: string }
  | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Titolo obbligatorio." };
  }
  const title = raw.trim().replace(/\s+/g, " ");
  if (!title) {
    return { ok: false, error: "Titolo obbligatorio." };
  }
  if (title.length > TRAINING_TITLE_MAX) {
    return { ok: false, error: `Titolo troppo lungo (max ${TRAINING_TITLE_MAX}).` };
  }
  return { ok: true, title };
}

export function normalizeOptionalText(
  raw: unknown,
  max: number,
  label: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw == null || raw === "") {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: `${label} non valida.` };
  }
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return { ok: true, value: null };
  if (value.length > max) {
    return { ok: false, error: `${label} troppo lunga (max ${max}).` };
  }
  return { ok: true, value };
}

export function normalizeDurationMin(raw: unknown):
  | { ok: true; durationMin: number | null }
  | { ok: false; error: string } {
  if (raw == null || raw === "") {
    return { ok: true, durationMin: null };
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    return { ok: false, error: "Durata non valida." };
  }
  if (n > TRAINING_DURATION_MAX) {
    return {
      ok: false,
      error: `Durata troppo alta (max ${TRAINING_DURATION_MAX} min).`,
    };
  }
  return { ok: true, durationMin: n };
}

/** Somma solo le durate presenti; non inventa valori. */
export function sumSessionDurationMin(
  items: Array<{ durationMin: number | null | undefined }>,
): number {
  let sum = 0;
  for (const item of items) {
    if (typeof item.durationMin === "number" && Number.isFinite(item.durationMin)) {
      sum += item.durationMin;
    }
  }
  return sum;
}

export function isTrainingEventType(type: string): boolean {
  return type === "TRAINING";
}

/**
 * Snapshot da template libreria: copia title/description/durationMin.
 * Modifiche successive al template NON devono alterare questo oggetto.
 */
export function snapshotFromExercise(
  exercise: TrainingExerciseSnapshotSource,
): {
  exerciseId: string;
  title: string;
  description: string | null;
  durationMin: number | null;
} {
  return {
    exerciseId: exercise.id,
    title: exercise.title,
    description: exercise.description,
    durationMin: exercise.durationMin,
  };
}

export function reorderSessionItems<T extends { sortOrder: number }>(
  items: T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items.map((item, index) => ({ ...item, sortOrder: index }));
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next.map((item, index) => ({ ...item, sortOrder: index }));
}

export function moveSessionItemUp<T extends { sortOrder: number }>(
  items: T[],
  index: number,
): T[] {
  if (index <= 0) return items.map((item, i) => ({ ...item, sortOrder: i }));
  return reorderSessionItems(items, index, index - 1);
}

export function moveSessionItemDown<T extends { sortOrder: number }>(
  items: T[],
  index: number,
): T[] {
  if (index < 0 || index >= items.length - 1) {
    return items.map((item, i) => ({ ...item, sortOrder: i }));
  }
  return reorderSessionItems(items, index, index + 1);
}

export function validateSessionItemsPayload(raw: unknown):
  | { ok: true; items: TrainingItemInput[] }
  | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Elenco esercizi non valido." };
  }
  if (raw.length > TRAINING_SESSION_ITEMS_MAX) {
    return {
      ok: false,
      error: `Troppi esercizi (max ${TRAINING_SESSION_ITEMS_MAX}).`,
    };
  }

  const items: TrainingItemInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as Record<string, unknown>;
    if (!row || typeof row !== "object") {
      return { ok: false, error: `Esercizio ${i + 1} non valido.` };
    }
    const titleResult = normalizeTrainingTitle(row.title);
    if (!titleResult.ok) {
      return { ok: false, error: `Esercizio ${i + 1}: ${titleResult.error}` };
    }
    const descResult = normalizeOptionalText(
      row.description,
      TRAINING_DESCRIPTION_MAX,
      "Descrizione",
    );
    if (!descResult.ok) {
      return { ok: false, error: `Esercizio ${i + 1}: ${descResult.error}` };
    }
    const durResult = normalizeDurationMin(row.durationMin);
    if (!durResult.ok) {
      return { ok: false, error: `Esercizio ${i + 1}: ${durResult.error}` };
    }
    const exerciseId =
      row.exerciseId == null || row.exerciseId === ""
        ? null
        : typeof row.exerciseId === "string"
          ? row.exerciseId
          : null;
    if (row.exerciseId != null && row.exerciseId !== "" && exerciseId === null) {
      return { ok: false, error: `Esercizio ${i + 1}: riferimento libreria non valido.` };
    }
    items.push({
      id: typeof row.id === "string" ? row.id : undefined,
      exerciseId,
      title: titleResult.title,
      description: descResult.value,
      durationMin: durResult.durationMin,
      sortOrder: i,
    });
  }
  return { ok: true, items };
}

/**
 * Visibilità libreria:
 * - categoryId valorizzato → coach assegnati a quella categoria (+ ADMIN/YD)
 * - categoryId null → SOLO autore (+ ADMIN/YD). Nessuna knowledge base globale.
 */
export function canViewTrainingExercise(params: {
  role: string;
  userId: string;
  allowedCategoryIds: string[];
  exercise: { createdById: string; categoryId: string | null };
}): boolean {
  if (params.role === "ADMIN" || params.role === "YOUTH_DIRECTOR") {
    return true;
  }
  if (params.role !== "COACH") {
    return false;
  }
  if (params.exercise.categoryId) {
    return params.allowedCategoryIds.includes(params.exercise.categoryId);
  }
  return params.exercise.createdById === params.userId;
}

export function canManageTrainingExercise(params: {
  role: string;
  userId: string;
  allowedCategoryIds: string[];
  exercise: { createdById: string; categoryId: string | null };
}): boolean {
  if (params.role === "ADMIN" || params.role === "YOUTH_DIRECTOR") {
    return true;
  }
  if (params.role !== "COACH") {
    return false;
  }
  if (params.exercise.categoryId) {
    return params.allowedCategoryIds.includes(params.exercise.categoryId);
  }
  return params.exercise.createdById === params.userId;
}

export function buildExerciseLibraryWhere(params: {
  role: string;
  userId: string;
  allowedCategoryIds: string[];
  categoryIdFilter?: string | null;
}): Record<string, unknown> {
  if (params.role === "ADMIN" || params.role === "YOUTH_DIRECTOR") {
    if (params.categoryIdFilter) {
      return {
        OR: [
          { categoryId: params.categoryIdFilter },
          { categoryId: null },
        ],
      };
    }
    return {};
  }

  const ors: Array<Record<string, unknown>> = [
    { categoryId: null, createdById: params.userId },
  ];
  if (params.allowedCategoryIds.length > 0) {
    const cats = params.categoryIdFilter
      ? params.allowedCategoryIds.filter((id) => id === params.categoryIdFilter)
      : params.allowedCategoryIds;
    if (cats.length > 0) {
      ors.push({ categoryId: { in: cats } });
    }
  }
  return { OR: ors };
}
