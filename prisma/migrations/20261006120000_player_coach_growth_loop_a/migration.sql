-- Player & Coach Experience — Release A (Growth Loop).
-- ADDITIVA. NON eseguire automaticamente su produzione: review + apply manuale.
-- Contiene: AthletePersonalGoal + positiveTags su AthleteCoachNote.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AthletePersonalGoalStatus" AS ENUM ('IN_PROGRESS', 'ACHIEVED', 'CONTINUE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PositiveCoachTag" AS ENUM (
    'IMPEGNO',
    'CRESCITA',
    'SPIRITO_DI_SQUADRA',
    'COSTANZA',
    'CORAGGIO',
    'ASCOLTO'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable AthleteCoachNote: tag positivi (default vuoto, note esistenti ok)
ALTER TABLE "AthleteCoachNote"
  ADD COLUMN IF NOT EXISTS "positiveTags" "PositiveCoachTag"[] DEFAULT ARRAY[]::"PositiveCoachTag"[];

-- CreateTable AthletePersonalGoal
CREATE TABLE IF NOT EXISTS "AthletePersonalGoal" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "periodMonth" INTEGER,
    "periodYear" INTEGER,
    "status" "AthletePersonalGoalStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthletePersonalGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AthletePersonalGoal_athleteId_idx" ON "AthletePersonalGoal"("athleteId");
CREATE INDEX IF NOT EXISTS "AthletePersonalGoal_athleteId_status_idx" ON "AthletePersonalGoal"("athleteId", "status");
CREATE INDEX IF NOT EXISTS "AthletePersonalGoal_athleteId_periodYear_periodMonth_idx" ON "AthletePersonalGoal"("athleteId", "periodYear", "periodMonth");
CREATE INDEX IF NOT EXISTS "AthletePersonalGoal_authorId_idx" ON "AthletePersonalGoal"("authorId");
CREATE INDEX IF NOT EXISTS "AthletePersonalGoal_status_idx" ON "AthletePersonalGoal"("status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "AthletePersonalGoal" ADD CONSTRAINT "AthletePersonalGoal_athleteId_fkey"
    FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "AthletePersonalGoal" ADD CONSTRAINT "AthletePersonalGoal_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
