-- Social Studio: chiave stabile per archivio stemmi avversari.
-- Da applicare SOLO su DB locale/test finché non autorizzata in produzione.

ALTER TABLE "SocialAsset" ADD COLUMN IF NOT EXISTS "normalizedKey" TEXT;
ALTER TABLE "SocialAsset" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill grezzo (la normalizzazione completa resta in app su upload).
UPDATE "SocialAsset"
SET "normalizedKey" = NULLIF(
  lower(regexp_replace(regexp_replace(trim("label"), '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')),
  ''
)
WHERE "kind" = 'OPPONENT_LOGO' AND ("normalizedKey" IS NULL OR "normalizedKey" = '');

-- Evita collisioni sul unique: azzera chiavi duplicate tenendo il più recente.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "kind", "normalizedKey" ORDER BY "createdAt" DESC) AS rn
  FROM "SocialAsset"
  WHERE "normalizedKey" IS NOT NULL
)
UPDATE "SocialAsset" a
SET "normalizedKey" = NULL
FROM ranked r
WHERE a.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "SocialAsset_kind_normalizedKey_key"
ON "SocialAsset"("kind", "normalizedKey");
