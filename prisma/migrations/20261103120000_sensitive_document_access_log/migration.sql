-- CreateEnum
CREATE TYPE "SensitiveDocumentResourceType" AS ENUM ('ENROLLMENT_DOCUMENT', 'ARCHIVE_DOCUMENT');

-- CreateEnum
CREATE TYPE "SensitiveDocumentAccessAction" AS ENUM ('DOWNLOAD', 'VIEW');

-- CreateEnum
CREATE TYPE "SensitiveDocumentAccessOutcome" AS ENUM ('ALLOWED', 'DENIED');

-- CreateTable
CREATE TABLE "SensitiveDocumentAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userRole" "UserRole" NOT NULL,
    "action" "SensitiveDocumentAccessAction" NOT NULL,
    "resourceType" "SensitiveDocumentResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "documentType" TEXT,
    "athleteId" TEXT,
    "outcome" "SensitiveDocumentAccessOutcome" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensitiveDocumentAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SensitiveDocumentAccessLog_resourceType_resourceId_createdAt_idx" ON "SensitiveDocumentAccessLog"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "SensitiveDocumentAccessLog_userId_createdAt_idx" ON "SensitiveDocumentAccessLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SensitiveDocumentAccessLog_athleteId_createdAt_idx" ON "SensitiveDocumentAccessLog"("athleteId", "createdAt");

-- CreateIndex
CREATE INDEX "SensitiveDocumentAccessLog_outcome_createdAt_idx" ON "SensitiveDocumentAccessLog"("outcome", "createdAt");

-- AddForeignKey
ALTER TABLE "SensitiveDocumentAccessLog" ADD CONSTRAINT "SensitiveDocumentAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
