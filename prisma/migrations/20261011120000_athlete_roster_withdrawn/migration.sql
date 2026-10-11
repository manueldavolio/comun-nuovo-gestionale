-- Ritiro atleta pagante: stato rosa ACTIVE/WITHDRAWN senza cancellare storico economico.

CREATE TYPE "AthleteRosterStatus" AS ENUM ('ACTIVE', 'WITHDRAWN');

ALTER TABLE "Athlete" ADD COLUMN "rosterStatus" "AthleteRosterStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Athlete" ADD COLUMN "withdrawnAt" TIMESTAMP(3);
ALTER TABLE "Athlete" ADD COLUMN "withdrawReason" TEXT;

CREATE INDEX "Athlete_rosterStatus_idx" ON "Athlete"("rosterStatus");
