-- CreateEnum
CREATE TYPE "BankTransferRequestStatus" AS ENUM ('AWAITING_PROOF', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "ClubBankSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "beneficiary" TEXT NOT NULL DEFAULT '',
    "iban" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "ClubBankSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransferRequest" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "causal" TEXT NOT NULL,
    "status" "BankTransferRequestStatus" NOT NULL DEFAULT 'AWAITING_PROOF',
    "proofFilePath" TEXT,
    "proofMimeType" TEXT,
    "proofUploadedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankTransferRequest_causal_key" ON "BankTransferRequest"("causal");

-- CreateIndex
CREATE INDEX "BankTransferRequest_paymentId_status_idx" ON "BankTransferRequest"("paymentId", "status");

-- CreateIndex
CREATE INDEX "BankTransferRequest_status_createdAt_idx" ON "BankTransferRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BankTransferRequest_createdById_idx" ON "BankTransferRequest"("createdById");

-- CreateIndex
CREATE INDEX "BankTransferRequest_reviewedById_idx" ON "BankTransferRequest"("reviewedById");

-- AddForeignKey
ALTER TABLE "ClubBankSettings" ADD CONSTRAINT "ClubBankSettings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferRequest" ADD CONSTRAINT "BankTransferRequest_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferRequest" ADD CONSTRAINT "BankTransferRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransferRequest" ADD CONSTRAINT "BankTransferRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
