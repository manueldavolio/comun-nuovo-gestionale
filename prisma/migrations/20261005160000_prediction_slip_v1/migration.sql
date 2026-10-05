-- Schedina Comun Nuovo V1 (PredictionSlip 1-X-2).
-- ADDITIVA. NON eseguire automaticamente su produzione: review + apply manuale.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PredictionChoice" AS ENUM ('HOME', 'DRAW', 'AWAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PredictionSlip" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prizeText" TEXT NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "effectiveClosesAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PredictionSlipEvent" (
    "id" TEXT NOT NULL,
    "slipId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionSlipEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PredictionEntry" (
    "id" TEXT NOT NULL,
    "slipId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PredictionPick" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "slipEventId" TEXT NOT NULL,
    "choice" "PredictionChoice" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PredictionPick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PredictionSlip_isPublished_closesAt_idx" ON "PredictionSlip"("isPublished", "closesAt");
CREATE INDEX IF NOT EXISTS "PredictionSlip_createdById_idx" ON "PredictionSlip"("createdById");
CREATE INDEX IF NOT EXISTS "PredictionSlip_lockedAt_idx" ON "PredictionSlip"("lockedAt");
CREATE INDEX IF NOT EXISTS "PredictionSlip_effectiveClosesAt_idx" ON "PredictionSlip"("effectiveClosesAt");

CREATE UNIQUE INDEX IF NOT EXISTS "PredictionSlipEvent_slipId_eventId_key" ON "PredictionSlipEvent"("slipId", "eventId");
CREATE INDEX IF NOT EXISTS "PredictionSlipEvent_slipId_sortOrder_idx" ON "PredictionSlipEvent"("slipId", "sortOrder");
CREATE INDEX IF NOT EXISTS "PredictionSlipEvent_eventId_idx" ON "PredictionSlipEvent"("eventId");

CREATE UNIQUE INDEX IF NOT EXISTS "PredictionEntry_slipId_parentId_key" ON "PredictionEntry"("slipId", "parentId");
CREATE INDEX IF NOT EXISTS "PredictionEntry_parentId_idx" ON "PredictionEntry"("parentId");
CREATE INDEX IF NOT EXISTS "PredictionEntry_slipId_idx" ON "PredictionEntry"("slipId");

CREATE UNIQUE INDEX IF NOT EXISTS "PredictionPick_entryId_slipEventId_key" ON "PredictionPick"("entryId", "slipEventId");
CREATE INDEX IF NOT EXISTS "PredictionPick_slipEventId_idx" ON "PredictionPick"("slipEventId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PredictionSlip" ADD CONSTRAINT "PredictionSlip_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PredictionSlipEvent" ADD CONSTRAINT "PredictionSlipEvent_slipId_fkey"
    FOREIGN KEY ("slipId") REFERENCES "PredictionSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PredictionSlipEvent" ADD CONSTRAINT "PredictionSlipEvent_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PredictionEntry" ADD CONSTRAINT "PredictionEntry_slipId_fkey"
    FOREIGN KEY ("slipId") REFERENCES "PredictionSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PredictionEntry" ADD CONSTRAINT "PredictionEntry_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PredictionPick" ADD CONSTRAINT "PredictionPick_entryId_fkey"
    FOREIGN KEY ("entryId") REFERENCES "PredictionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "PredictionPick" ADD CONSTRAINT "PredictionPick_slipEventId_fkey"
    FOREIGN KEY ("slipEventId") REFERENCES "PredictionSlipEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
