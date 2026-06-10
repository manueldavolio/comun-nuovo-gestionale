-- Aggiorna annata Scuola Calcio
UPDATE "Category"
SET "birthYearsLabel" = '2020/2021/2022',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'Scuola Calcio'
  AND "birthYearsLabel" = '2020/2021';

-- Aggiunge Gioco Sport (stessa stagione e quote di Scuola Calcio)
INSERT INTO "Category" (
  "id",
  "name",
  "birthYearsLabel",
  "seasonLabel",
  "annualFee",
  "depositFee",
  "balanceFee",
  "isActive",
  "createdAt",
  "updatedAt"
)
SELECT
  'cm4giocosport20222301',
  'Gioco Sport',
  '2022/2023',
  src."seasonLabel",
  src."annualFee",
  src."depositFee",
  src."balanceFee",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  SELECT "seasonLabel", "annualFee", "depositFee", "balanceFee"
  FROM "Category"
  WHERE "name" = 'Scuola Calcio'
  ORDER BY "createdAt" DESC
  LIMIT 1
) AS src
WHERE NOT EXISTS (
  SELECT 1
  FROM "Category" AS existing
  WHERE existing."name" = 'Gioco Sport'
    AND existing."seasonLabel" = src."seasonLabel"
);
