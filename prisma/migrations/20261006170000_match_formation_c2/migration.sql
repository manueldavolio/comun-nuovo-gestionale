-- Release C2: MatchFormation + MatchFormationSlot (sempre privata — solo staff)

CREATE TABLE "MatchFormation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchFormation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchFormationSlot" (
    "id" TEXT NOT NULL,
    "formationId" TEXT NOT NULL,
    "slotKey" TEXT NOT NULL,
    "athleteId" TEXT,
    "isBench" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchFormationSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchFormation_eventId_key" ON "MatchFormation"("eventId");
CREATE UNIQUE INDEX "MatchFormationSlot_formationId_slotKey_key" ON "MatchFormationSlot"("formationId", "slotKey");

CREATE INDEX "MatchFormation_createdById_idx" ON "MatchFormation"("createdById");
CREATE INDEX "MatchFormationSlot_formationId_sortOrder_idx" ON "MatchFormationSlot"("formationId", "sortOrder");
CREATE INDEX "MatchFormationSlot_athleteId_idx" ON "MatchFormationSlot"("athleteId");

ALTER TABLE "MatchFormation" ADD CONSTRAINT "MatchFormation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchFormation" ADD CONSTRAINT "MatchFormation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MatchFormationSlot" ADD CONSTRAINT "MatchFormationSlot_formationId_fkey" FOREIGN KEY ("formationId") REFERENCES "MatchFormation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchFormationSlot" ADD CONSTRAINT "MatchFormationSlot_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE SET NULL ON UPDATE CASCADE;
