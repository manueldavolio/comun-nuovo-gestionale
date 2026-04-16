-- DropIndex
DROP INDEX IF EXISTS "AccountingEntry_type_date_idx";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AccountingEntry_type_entryDate_idx" ON "AccountingEntry"("type", "entryDate");
