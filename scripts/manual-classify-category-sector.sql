-- =============================================================================
-- E0.1d — Procedura MANUALE di classificazione Category.sector
-- =============================================================================
-- Eseguire SOLO dopo aver applicato la migrazione 20261027120000_category_sector
-- e SOLO su un ambiente autorizzato (locale / staging / produzione con OK esplicito).
--
-- NON eseguire blindemente: verificare i record reali con la SELECT 1, poi aggiornare
-- per id (o con WHERE name esatto + seasonLabel) dopo conferma umana.
-- Categorie dubbie: lasciare sector NULL.
-- =============================================================================

-- 1) Inventario attuale
SELECT
  id,
  name,
  "seasonLabel",
  "isActive",
  sector,
  "birthYearsLabel"
FROM "Category"
ORDER BY name ASC, "seasonLabel" ASC;

-- 2) Solo non classificate
SELECT id, name, "seasonLabel", "isActive"
FROM "Category"
WHERE sector IS NULL
ORDER BY name ASC;

-- 3) Template UPDATE (sostituire :id dopo verifica)
-- Prima Squadra → FIRST_TEAM
-- UPDATE "Category"
-- SET sector = 'FIRST_TEAM', "updatedAt" = CURRENT_TIMESTAMP
-- WHERE id = ':id'
--   AND name ILIKE 'Prima Squadra%';  -- controllo umano, non unico criterio

-- Settore giovanile tipico → YOUTH (una riga per id verificato)
-- UPDATE "Category"
-- SET sector = 'YOUTH', "updatedAt" = CURRENT_TIMESTAMP
-- WHERE id = ':id';
--   -- Nomi attesi (verificare caso per caso): Juniores, Allievi, Giovanissimi,
--   -- Esordienti, Pulcini, Primi Calci, Scuola Calcio, Under 15/17/19, …

-- 4) Controlli post-classificazione
SELECT sector, COUNT(*) AS n
FROM "Category"
GROUP BY sector
ORDER BY sector NULLS FIRST;

SELECT id, name, "seasonLabel"
FROM "Category"
WHERE sector IS NULL
ORDER BY name ASC;
