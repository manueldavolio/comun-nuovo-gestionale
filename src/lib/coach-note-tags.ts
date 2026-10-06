export const POSITIVE_COACH_TAGS = [
  "IMPEGNO",
  "CRESCITA",
  "SPIRITO_DI_SQUADRA",
  "COSTANZA",
  "CORAGGIO",
  "ASCOLTO",
] as const;

export const MAX_POSITIVE_COACH_TAGS = 3;

export type PositiveCoachTagCode = (typeof POSITIVE_COACH_TAGS)[number];

export const POSITIVE_COACH_TAG_LABEL: Record<PositiveCoachTagCode, string> = {
  IMPEGNO: "Impegno",
  CRESCITA: "Crescita",
  SPIRITO_DI_SQUADRA: "Spirito di squadra",
  COSTANZA: "Costanza",
  CORAGGIO: "Coraggio",
  ASCOLTO: "Ascolto",
};

export function isPositiveCoachTag(value: unknown): value is PositiveCoachTagCode {
  return (
    typeof value === "string" &&
    (POSITIVE_COACH_TAGS as readonly string[]).includes(value)
  );
}

/** Normalizza e valida 0–3 tag unici; reject se invalidi o >3. */
export function normalizePositiveCoachTags(
  raw: unknown,
): { ok: true; tags: PositiveCoachTagCode[] } | { ok: false; error: string } {
  if (raw == null) {
    return { ok: true, tags: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: "Tag non validi." };
  }
  if (raw.length > MAX_POSITIVE_COACH_TAGS) {
    return {
      ok: false,
      error: `Massimo ${MAX_POSITIVE_COACH_TAGS} tag positivi.`,
    };
  }

  const tags: PositiveCoachTagCode[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isPositiveCoachTag(item)) {
      return { ok: false, error: "Tag non consentito." };
    }
    if (seen.has(item)) continue;
    seen.add(item);
    tags.push(item);
  }

  if (tags.length > MAX_POSITIVE_COACH_TAGS) {
    return {
      ok: false,
      error: `Massimo ${MAX_POSITIVE_COACH_TAGS} tag positivi.`,
    };
  }

  return { ok: true, tags };
}

export function formatCoachNoteAuthorLabel(input: {
  name: string | null | undefined;
  role: string | null | undefined;
}): { displayName: string; prefix: string; fullLabel: string } {
  const displayName = (input.name ?? "").trim() || "Squadra";
  if (input.role === "COACH") {
    return {
      displayName,
      prefix: "Mister",
      fullLabel: `Mister ${displayName}`,
    };
  }
  return {
    displayName,
    prefix: "Staff",
    fullLabel: `Staff · ${displayName}`,
  };
}
