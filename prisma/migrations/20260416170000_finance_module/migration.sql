-- AlterTable
ALTER TABLE "AccountingEntry"
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "paymentId" TEXT;

-- DropIndex
DROP INDEX "AccountingEntry_type_entryDate_idx";

-- CreateIndex
CREATE UNIQUE INDEX "AccountingEntry_paymentId_key" ON "AccountingEntry"("paymentId");

-- CreateIndex
CREATE INDEX "AccountingEntry_type_date_idx" ON "AccountingEntry"("entryDate");

-- CreateIndex
CREATE INDEX "AccountingEntry_createdById_idx" ON "AccountingEntry"("createdById");

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingEntry" ADD CONSTRAINT "AccountingEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
