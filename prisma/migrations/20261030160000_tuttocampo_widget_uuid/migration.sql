-- AlterTable: campi UUID Tuttocampo + widget marcatori/ultima partita (additivo).
ALTER TABLE "CategoryCompetitionSource" ADD COLUMN IF NOT EXISTS "tuttocampoWidgetUuid" TEXT;
ALTER TABLE "CategoryCompetitionSource" ADD COLUMN IF NOT EXISTS "widgetSeasonParam" TEXT;
ALTER TABLE "CategoryCompetitionSource" ADD COLUMN IF NOT EXISTS "widgetScorersUrl" TEXT;
ALTER TABLE "CategoryCompetitionSource" ADD COLUMN IF NOT EXISTS "widgetLastMatchUrl" TEXT;

-- Seed: UUID ufficiale Esordienti → solo categorie Esordienti 2026/27 (idempotente).
-- Non riusa l'UUID se già collegato ad un'altra categoria.
WITH target AS (
  SELECT c.id AS category_id, c."seasonLabel" AS season_label, c.name AS category_name
  FROM "Category" c
  WHERE c."isActive" = true
    AND c."seasonLabel" IN ('2026/2027', '2026/27', '2026-2027', '2026-27')
    AND c.name ~* 'esordienti'
),
urls AS (
  SELECT
    '99f6f12c-cb8c-4119-a461-2cb01911ca55'::text AS uuid,
    '2026-27'::text AS y,
    'https://www.tuttocampo.it/WidgetV2/Risultati/99f6f12c-cb8c-4119-a461-2cb01911ca55?y=2026-27'::text AS results,
    'https://www.tuttocampo.it/WidgetV2/Classifica/99f6f12c-cb8c-4119-a461-2cb01911ca55?y=2026-27'::text AS standings,
    'https://www.tuttocampo.it/WidgetV2/Marcatori/99f6f12c-cb8c-4119-a461-2cb01911ca55?y=2026-27'::text AS scorers,
    'https://www.tuttocampo.it/WidgetV2/Partita/99f6f12c-cb8c-4119-a461-2cb01911ca55?y=2026-27'::text AS last_match,
    'https://www.tuttocampo.it/WidgetV2/ProssimaPartita/99f6f12c-cb8c-4119-a461-2cb01911ca55?y=2026-27'::text AS next_match
)
INSERT INTO "CategoryCompetitionSource" (
  id,
  "categoryId",
  "seasonLabel",
  "competitionName",
  "groupLabel",
  "sourceType",
  "tuttocampoWidgetUuid",
  "widgetSeasonParam",
  "widgetStandingsUrl",
  "widgetResultsUrl",
  "widgetScorersUrl",
  "widgetLastMatchUrl",
  "widgetNextMatchUrl",
  "sourceNotes",
  "lastVerifiedAt",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'seed_esordienti_tc_' || t.category_id,
  t.category_id,
  t.season_label,
  'Esordienti',
  NULL,
  'TUTTOCAMPO',
  u.uuid,
  u.y,
  u.standings,
  u.results,
  u.scorers,
  u.last_match,
  u.next_match,
  'UUID ufficiale Esordienti (club). In area genitori: risultati/partite sì; classifica/marcatori nascosti.',
  TIMESTAMPTZ '2026-10-30 00:00:00+00',
  true,
  NOW(),
  NOW()
FROM target t
CROSS JOIN urls u
WHERE NOT EXISTS (
  SELECT 1 FROM "CategoryCompetitionSource" s WHERE s."categoryId" = t.category_id
)
AND NOT EXISTS (
  SELECT 1
  FROM "CategoryCompetitionSource" s
  WHERE lower(s."tuttocampoWidgetUuid") = lower(u.uuid)
);

-- Se la fonte Esordienti esiste già senza UUID, aggiorna solo quella categoria.
UPDATE "CategoryCompetitionSource" s
SET
  "sourceType" = 'TUTTOCAMPO',
  "tuttocampoWidgetUuid" = '99f6f12c-cb8c-4119-a461-2cb01911ca55',
  "widgetSeasonParam" = '2026-27',
  "widgetResultsUrl" = 'https://www.tuttocampo.it/WidgetV2/Risultati/99f6f12c-cb8c-4119-a461-2cb01911ca55?y=2026-27',
  "widgetStandingsUrl" = 'https://www.tuttocampo.it/WidgetV2/Classifica/99f6f12c-cb8c-4119-a461-2cb01911ca55?y=2026-27',
  "widgetScorersUrl" = 'https://www.tuttocampo.it/WidgetV2/Marcatori/99f6f12c-cb8c-4119-a461-2cb01911ca55?y=2026-27',
  "widgetLastMatchUrl" = 'https://www.tuttocampo.it/WidgetV2/Partita/99f6f12c-cb8c-4119-a461-2cb01911ca55?y=2026-27',
  "widgetNextMatchUrl" = 'https://www.tuttocampo.it/WidgetV2/ProssimaPartita/99f6f12c-cb8c-4119-a461-2cb01911ca55?y=2026-27',
  "sourceNotes" = COALESCE(
    s."sourceNotes",
    'UUID ufficiale Esordienti (club). In area genitori: risultati/partite sì; classifica/marcatori nascosti.'
  ),
  "lastVerifiedAt" = COALESCE(s."lastVerifiedAt", TIMESTAMPTZ '2026-10-30 00:00:00+00'),
  "updatedAt" = NOW()
FROM "Category" c
WHERE s."categoryId" = c.id
  AND c."isActive" = true
  AND c.name ~* 'esordienti'
  AND c."seasonLabel" IN ('2026/2027', '2026/27', '2026-2027', '2026-27')
  AND (s."tuttocampoWidgetUuid" IS NULL OR s."tuttocampoWidgetUuid" = '')
  AND NOT EXISTS (
    SELECT 1
    FROM "CategoryCompetitionSource" other
    WHERE lower(other."tuttocampoWidgetUuid") = lower('99f6f12c-cb8c-4119-a461-2cb01911ca55')
      AND other."categoryId" <> s."categoryId"
  );
