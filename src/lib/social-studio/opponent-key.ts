/** Normalizza nomi squadra per archivio stemmi (omonimie / varianti leggere). */

const STRIP_PREFIXES = [
  "asd",
  "a.s.d.",
  "a.s.d",
  "us",
  "u.s.",
  "u.s",
  "ac",
  "a.c.",
  "fc",
  "f.c.",
  "ssd",
  "s.s.d.",
  "gs",
  "g.s.",
  "pol",
  "polisportiva",
  "or",
  "oratorio",
  "soc",
  "societa",
];

/**
 * Espande abbreviazioni frequenti nei calendari locali
 * (es. "Or." → "oratorio") prima della normalizzazione.
 */
function expandCommonAbbreviations(raw: string): string {
  return raw
    .replace(/\bor\.?\b/gi, "oratorio")
    .replace(/\bsoc\.?\b/gi, "societa")
    .replace(/\bpol\.?\b/gi, "polisportiva");
}

export function normalizeOpponentKey(raw: string): string {
  let base = expandCommonAbbreviations(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, " ");

  // Prefissi societari con o senza punti/spazi (A.S.D. / ASD / U.S. …)
  base = base
    .replace(/\ba\.?\s*s\.?\s*d\.?\b/g, " ")
    .replace(/\bs\.?\s*s\.?\s*d\.?\b/g, " ")
    .replace(/\bu\.?\s*s\.?\b/g, " ")
    .replace(/\ba\.?\s*c\.?\b/g, " ")
    .replace(/\bf\.?\s*c\.?\b/g, " ")
    .replace(/\bg\.?\s*s\.?\b/g, " ")
    .replace(/\boratorio\b/g, " ")
    .replace(/\bsocieta\b/g, " ")
    .replace(/\bpolisportiva\b/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) return "";

  const tokens = base.split(" ").filter(Boolean);
  while (tokens.length > 1 && STRIP_PREFIXES.includes(tokens[0]!)) {
    tokens.shift();
  }

  return tokens.join("-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Distanza di Levenshtein limitata (per suggerimenti omonimia). */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const nextDiag = prev[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + cost);
      diag = nextDiag;
    }
  }
  return prev[b.length]!;
}

export type OpponentAssetMatch<T extends { label: string; normalizedKey?: string | null }> =
  | { kind: "exact"; asset: T }
  | { kind: "fuzzy"; asset: T; distance: number }
  | { kind: "none" };

export function matchOpponentAsset<T extends { label: string; normalizedKey?: string | null }>(
  opponentName: string,
  assets: T[],
): OpponentAssetMatch<T> {
  const key = normalizeOpponentKey(opponentName);
  if (!key || assets.length === 0) return { kind: "none" };

  const exact = assets.find((asset) => {
    const assetKey = asset.normalizedKey || normalizeOpponentKey(asset.label);
    return assetKey === key;
  });
  if (exact) return { kind: "exact", asset: exact };

  let best: { asset: T; distance: number } | null = null;
  for (const asset of assets) {
    const assetKey = asset.normalizedKey || normalizeOpponentKey(asset.label);
    if (!assetKey) continue;
    const distance = editDistance(key, assetKey);
    const threshold = Math.max(1, Math.floor(Math.min(key.length, assetKey.length) * 0.2));
    if (distance > 0 && distance <= threshold) {
      if (!best || distance < best.distance) best = { asset, distance };
    }
  }
  if (best) return { kind: "fuzzy", asset: best.asset, distance: best.distance };
  return { kind: "none" };
}

/**
 * Solo match esatti (chiave normalizzata o alias verificato).
 * I fuzzy NON vengono applicati automaticamente: richiedono conferma manuale.
 */
export function resolveExactOpponentLogoUrl<
  T extends { label: string; normalizedKey?: string | null; publicUrl: string },
>(opponentName: string, assets: T[]): string | null {
  const match = matchOpponentAsset(opponentName, assets);
  return match.kind === "exact" ? match.asset.publicUrl : null;
}
