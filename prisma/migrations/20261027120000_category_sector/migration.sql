-- E0.1d Fase 1 — Category.sector (YOUTH | FIRST_TEAM), nullable.
-- Non distruttiva: nessuna ALTER su dati esistenti oltre alla nuova colonna.
-- Nessun DEFAULT su sector: le categorie esistenti restano NULL (da classificare a mano).
-- Nessun backfill automatico basato sul nome.

CREATE TYPE "CategorySector" AS ENUM ('YOUTH', 'FIRST_TEAM');

ALTER TABLE "Category" ADD COLUMN "sector" "CategorySector";

CREATE INDEX "Category_sector_idx" ON "Category"("sector");
