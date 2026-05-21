-- CreateEnum
CREATE TYPE "EnrollmentDocumentType" AS ENUM (
  'PARENT_ID_FRONT',
  'PARENT_ID_BACK',
  'ATHLETE_ID_FRONT',
  'ATHLETE_ID_BACK',
  'ATHLETE_PORTRAIT'
);

-- CreateTable
CREATE TABLE "EnrollmentDocument" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "type" "EnrollmentDocumentType" NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EnrollmentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EnrollmentDocument_enrollmentId_idx" ON "EnrollmentDocument"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "EnrollmentDocument_enrollmentId_type_key" ON "EnrollmentDocument"("enrollmentId", "type");

-- AddForeignKey
ALTER TABLE "EnrollmentDocument"
ADD CONSTRAINT "EnrollmentDocument_enrollmentId_fkey"
FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
