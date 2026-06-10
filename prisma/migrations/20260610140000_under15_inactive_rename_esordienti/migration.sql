-- Disattiva la categoria Under 15: non sara' piu' selezionabile nelle nuove iscrizioni.
-- Gli atleti eventualmente gia' assegnati restano associati e visibili.
UPDATE "Category"
SET "isActive" = false,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Under 15';

-- Elimina Under 15 SOLO se non e' referenziata da nessun dato
-- (nessun atleta, iscrizione, evento, convocazione, comunicazione, media, report o assegnazione mister).
DELETE FROM "Category" AS c
WHERE c."name" = 'Under 15'
  AND NOT EXISTS (SELECT 1 FROM "Athlete" a WHERE a."categoryId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."categoryId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "Event" ev WHERE ev."categoryId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "Convocation" cv WHERE cv."categoryId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "Announcement" an WHERE an."categoryId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "MediaItem" m WHERE m."categoryId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "MonthlyCoachReport" r WHERE r."categoryId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "CoachCategoryAssignment" ca WHERE ca."categoryId" = c."id");

-- Rinomina "Esordienti" in "Esordienti U15" (l'annata 2012/2013 resta in birthYearsLabel).
-- L'id della categoria non cambia: tutti gli atleti, le iscrizioni e i pagamenti restano collegati.
UPDATE "Category" AS c
SET "name" = 'Esordienti U15',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE c."name" = 'Esordienti'
  AND NOT EXISTS (
    SELECT 1
    FROM "Category" AS other
    WHERE other."name" = 'Esordienti U15'
      AND other."seasonLabel" = c."seasonLabel"
  );

-- Variante difensiva nel caso il nome salvato includa gia' l'annata.
UPDATE "Category" AS c
SET "name" = 'Esordienti U15 2012/2013',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE c."name" = 'Esordienti 2012/2013'
  AND NOT EXISTS (
    SELECT 1
    FROM "Category" AS other
    WHERE other."name" = 'Esordienti U15 2012/2013'
      AND other."seasonLabel" = c."seasonLabel"
  );
