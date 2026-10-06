-- Release C — Category.playersPerSide (tra C1 training e C2 formation)
-- Nullable + backfill esplicito categorie Comun Nuovo.

ALTER TABLE "Category" ADD COLUMN "playersPerSide" INTEGER;

-- Match case-insensitive su prefisso nome (varianti: Primi Calci, Pulcini 2016, Esordienti U15, …)
UPDATE "Category"
SET "playersPerSide" = 5,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(trim("name")) LIKE 'primi calci%';

UPDATE "Category"
SET "playersPerSide" = 7,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(trim("name")) LIKE 'pulcini%';

UPDATE "Category"
SET "playersPerSide" = 9,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE lower(trim("name")) LIKE 'esordienti%';

-- Tutte le altre categorie attuali → calcio a 11
UPDATE "Category"
SET "playersPerSide" = 11,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "playersPerSide" IS NULL;
