-- AlterTable Athlete: optional shirt/position (non-destructive)
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "position" TEXT;
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "shirtNumber" INTEGER;

-- AlterTable Event: optional match result fields (non-destructive)
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "opponentName" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "homeScore" INTEGER;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "awayScore" INTEGER;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "isHome" BOOLEAN;

-- CreateTable MatchPlayerStat
CREATE TABLE IF NOT EXISTS "MatchPlayerStat" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPlayerStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MatchPlayerStat_eventId_athleteId_key" ON "MatchPlayerStat"("eventId", "athleteId");
CREATE INDEX IF NOT EXISTS "MatchPlayerStat_athleteId_idx" ON "MatchPlayerStat"("athleteId");
CREATE INDEX IF NOT EXISTS "MatchPlayerStat_eventId_idx" ON "MatchPlayerStat"("eventId");

DO $$ BEGIN
  ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "MatchPlayerStat" ADD CONSTRAINT "MatchPlayerStat_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable AthleteCoachNote
CREATE TABLE IF NOT EXISTS "AthleteCoachNote" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteCoachNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AthleteCoachNote_athleteId_year_month_key" ON "AthleteCoachNote"("athleteId", "year", "month");
CREATE INDEX IF NOT EXISTS "AthleteCoachNote_athleteId_year_month_idx" ON "AthleteCoachNote"("athleteId", "year", "month");
CREATE INDEX IF NOT EXISTS "AthleteCoachNote_authorId_idx" ON "AthleteCoachNote"("authorId");

DO $$ BEGIN
  ALTER TABLE "AthleteCoachNote" ADD CONSTRAINT "AthleteCoachNote_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "AthleteCoachNote" ADD CONSTRAINT "AthleteCoachNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
