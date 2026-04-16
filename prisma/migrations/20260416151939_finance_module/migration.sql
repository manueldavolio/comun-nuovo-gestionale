-- DropIndex
DROP INDEX "AccountingEntry_type_date_idx";

-- CreateIndex
CREATE INDEX "AccountingEntry_type_entryDate_idx" ON "AccountingEntry"("type", "entryDate");
