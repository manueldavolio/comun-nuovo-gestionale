-- Area Mister: disciplina (cartellini, apertura pregressa, squalifiche),
-- CompetitionKind su Event, valutazioni postpartita. Non distruttiva.

CREATE TYPE "CompetitionKind" AS ENUM ('LEAGUE', 'CUP', 'TOURNAMENT', 'FRIENDLY', 'OTHER');
CREATE TYPE "DisciplinarySanctionType" AS ENUM ('YELLOW_CARD', 'RED_CARD', 'SECOND_YELLOW_RED', 'DIRECT_SUSPENSION', 'OTHER');
CREATE TYPE "DisciplinaryRecordStatus" AS ENUM ('ACTIVE', 'VOIDED');
CREATE TYPE "SuspensionServeStatus" AS ENUM ('PENDING', 'SERVED', 'CANCELLED');
CREATE TYPE "DisciplinaryAuditEntityType" AS ENUM ('INCIDENT', 'SUSPENSION', 'SERVING', 'OPENING_BALANCE', 'MATCH_RATING');
CREATE TYPE "DisciplinaryAuditAction" AS ENUM ('CREATE', 'UPDATE', 'VOID', 'SERVE', 'UNSERVE', 'CORRECT');

ALTER TABLE "Event" ADD COLUMN "competitionKind" "CompetitionKind";
ALTER TABLE "Event" ADD COLUMN "seasonLabel" TEXT;
ALTER TABLE "Event" ADD COLUMN "countsForDiscipline" BOOLEAN NOT NULL DEFAULT true;

-- Backfill non distruttivo da EventType esistente.
UPDATE "Event"
SET "competitionKind" = 'LEAGUE',
    "countsForDiscipline" = true
WHERE "type" = 'LEAGUE_MATCH';

UPDATE "Event"
SET "competitionKind" = 'TOURNAMENT',
    "countsForDiscipline" = true
WHERE "type" = 'TOURNAMENT';

UPDATE "Event"
SET "competitionKind" = 'FRIENDLY',
    "countsForDiscipline" = false
WHERE "type" = 'FRIENDLY';

UPDATE "Event" e
SET "seasonLabel" = c."seasonLabel"
FROM "Category" c
WHERE e."categoryId" = c."id" AND e."seasonLabel" IS NULL;

CREATE INDEX "Event_competitionKind_idx" ON "Event"("competitionKind");
CREATE INDEX "Event_seasonLabel_idx" ON "Event"("seasonLabel");

CREATE TABLE "DisciplinaryIncident" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "eventId" TEXT,
    "seasonLabel" TEXT NOT NULL,
    "competitionKind" "CompetitionKind" NOT NULL,
    "type" "DisciplinarySanctionType" NOT NULL,
    "minute" INTEGER,
    "notes" TEXT,
    "status" "DisciplinaryRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinaryIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisciplinaryOpeningBalance" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "seasonLabel" TEXT NOT NULL,
    "competitionKind" "CompetitionKind" NOT NULL,
    "priorYellowCards" INTEGER NOT NULL DEFAULT 0,
    "priorYellowCardsForAccumulation" INTEGER NOT NULL DEFAULT 0,
    "priorRedCards" INTEGER NOT NULL DEFAULT 0,
    "openSuspensionMatchdays" INTEGER NOT NULL DEFAULT 0,
    "referenceDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinaryOpeningBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisciplinarySuspension" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT,
    "athleteId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "seasonLabel" TEXT NOT NULL,
    "competitionKind" "CompetitionKind" NOT NULL,
    "matchdaysTotal" INTEGER NOT NULL,
    "officialRef" TEXT,
    "decidedAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" "DisciplinaryRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinarySuspension_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisciplinarySuspensionServing" (
    "id" TEXT NOT NULL,
    "suspensionId" TEXT NOT NULL,
    "eventId" TEXT,
    "status" "SuspensionServeStatus" NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisciplinarySuspensionServing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisciplinaryAuditLog" (
    "id" TEXT NOT NULL,
    "entityType" "DisciplinaryAuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "DisciplinaryAuditAction" NOT NULL,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisciplinaryAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchPlayerRating" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "possessionScore" INTEGER,
    "outOfPossessionScore" INTEGER,
    "attitudeScore" INTEGER,
    "teamworkScore" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPlayerRating_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DisciplinaryIncident_athleteId_seasonLabel_competitionKind_status_idx" ON "DisciplinaryIncident"("athleteId", "seasonLabel", "competitionKind", "status");
CREATE INDEX "DisciplinaryIncident_eventId_idx" ON "DisciplinaryIncident"("eventId");
CREATE INDEX "DisciplinaryIncident_categoryId_idx" ON "DisciplinaryIncident"("categoryId");
CREATE INDEX "DisciplinaryIncident_createdById_idx" ON "DisciplinaryIncident"("createdById");

CREATE UNIQUE INDEX "DisciplinaryOpeningBalance_athleteId_seasonLabel_competitionKind_key" ON "DisciplinaryOpeningBalance"("athleteId", "seasonLabel", "competitionKind");
CREATE INDEX "DisciplinaryOpeningBalance_categoryId_seasonLabel_competitionKind_idx" ON "DisciplinaryOpeningBalance"("categoryId", "seasonLabel", "competitionKind");
CREATE INDEX "DisciplinaryOpeningBalance_createdById_idx" ON "DisciplinaryOpeningBalance"("createdById");

CREATE INDEX "DisciplinarySuspension_athleteId_seasonLabel_competitionKind_status_idx" ON "DisciplinarySuspension"("athleteId", "seasonLabel", "competitionKind", "status");
CREATE INDEX "DisciplinarySuspension_incidentId_idx" ON "DisciplinarySuspension"("incidentId");
CREATE INDEX "DisciplinarySuspension_categoryId_idx" ON "DisciplinarySuspension"("categoryId");
CREATE INDEX "DisciplinarySuspension_createdById_idx" ON "DisciplinarySuspension"("createdById");

CREATE INDEX "DisciplinarySuspensionServing_suspensionId_status_idx" ON "DisciplinarySuspensionServing"("suspensionId", "status");
CREATE INDEX "DisciplinarySuspensionServing_eventId_idx" ON "DisciplinarySuspensionServing"("eventId");
CREATE INDEX "DisciplinarySuspensionServing_confirmedById_idx" ON "DisciplinarySuspensionServing"("confirmedById");

CREATE INDEX "DisciplinaryAuditLog_entityType_entityId_createdAt_idx" ON "DisciplinaryAuditLog"("entityType", "entityId", "createdAt");
CREATE INDEX "DisciplinaryAuditLog_userId_idx" ON "DisciplinaryAuditLog"("userId");

CREATE UNIQUE INDEX "MatchPlayerRating_eventId_athleteId_key" ON "MatchPlayerRating"("eventId", "athleteId");
CREATE INDEX "MatchPlayerRating_athleteId_idx" ON "MatchPlayerRating"("athleteId");
CREATE INDEX "MatchPlayerRating_eventId_idx" ON "MatchPlayerRating"("eventId");
CREATE INDEX "MatchPlayerRating_createdById_idx" ON "MatchPlayerRating"("createdById");

ALTER TABLE "DisciplinaryIncident" ADD CONSTRAINT "DisciplinaryIncident_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryIncident" ADD CONSTRAINT "DisciplinaryIncident_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryIncident" ADD CONSTRAINT "DisciplinaryIncident_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryIncident" ADD CONSTRAINT "DisciplinaryIncident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryIncident" ADD CONSTRAINT "DisciplinaryIncident_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DisciplinaryOpeningBalance" ADD CONSTRAINT "DisciplinaryOpeningBalance_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryOpeningBalance" ADD CONSTRAINT "DisciplinaryOpeningBalance_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryOpeningBalance" ADD CONSTRAINT "DisciplinaryOpeningBalance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisciplinaryOpeningBalance" ADD CONSTRAINT "DisciplinaryOpeningBalance_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DisciplinarySuspension" ADD CONSTRAINT "DisciplinarySuspension_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "DisciplinaryIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinarySuspension" ADD CONSTRAINT "DisciplinarySuspension_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisciplinarySuspension" ADD CONSTRAINT "DisciplinarySuspension_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisciplinarySuspension" ADD CONSTRAINT "DisciplinarySuspension_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DisciplinarySuspension" ADD CONSTRAINT "DisciplinarySuspension_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DisciplinarySuspensionServing" ADD CONSTRAINT "DisciplinarySuspensionServing_suspensionId_fkey" FOREIGN KEY ("suspensionId") REFERENCES "DisciplinarySuspension"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DisciplinarySuspensionServing" ADD CONSTRAINT "DisciplinarySuspensionServing_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DisciplinarySuspensionServing" ADD CONSTRAINT "DisciplinarySuspensionServing_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DisciplinaryAuditLog" ADD CONSTRAINT "DisciplinaryAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MatchPlayerRating" ADD CONSTRAINT "MatchPlayerRating_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchPlayerRating" ADD CONSTRAINT "MatchPlayerRating_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchPlayerRating" ADD CONSTRAINT "MatchPlayerRating_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchPlayerRating" ADD CONSTRAINT "MatchPlayerRating_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
