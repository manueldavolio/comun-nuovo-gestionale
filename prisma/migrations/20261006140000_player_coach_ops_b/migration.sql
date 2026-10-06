-- Player & Coach Experience — Release B (Coach Ops).
-- ADDITIVA. NON eseguire automaticamente su produzione: review + apply manuale.
-- Contiene: AthleteOperationalStatus (disponibilità rosa). Nessun backfill.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AthleteOperationalStatusType" AS ENUM (
    'AVAILABLE',
    'TO_CHECK',
    'INJURED',
    'ILL',
    'ABSENT'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AthleteOperationalStatus" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" "AthleteOperationalStatusType" NOT NULL,
    "note" TEXT,
    "setById" TEXT NOT NULL,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteOperationalStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AthleteOperationalStatus_athleteId_key" ON "AthleteOperationalStatus"("athleteId");
CREATE INDEX IF NOT EXISTS "AthleteOperationalStatus_status_idx" ON "AthleteOperationalStatus"("status");
CREATE INDEX IF NOT EXISTS "AthleteOperationalStatus_validUntil_idx" ON "AthleteOperationalStatus"("validUntil");
CREATE INDEX IF NOT EXISTS "AthleteOperationalStatus_setById_idx" ON "AthleteOperationalStatus"("setById");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AthleteOperationalStatus" ADD CONSTRAINT "AthleteOperationalStatus_athleteId_fkey"
    FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "AthleteOperationalStatus" ADD CONSTRAINT "AthleteOperationalStatus_setById_fkey"
    FOREIGN KEY ("setById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
