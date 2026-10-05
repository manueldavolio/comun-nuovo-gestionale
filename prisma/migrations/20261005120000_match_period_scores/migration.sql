-- MatchPeriodScore: risultati per tempo (Pulcini / Esordienti).
-- ADDITIVA: non altera Event.homeScore/awayScore esistenti.
-- NON eseguire automaticamente: revisione manuale su Supabase dopo revisione.

-- CreateTable
CREATE TABLE "MatchPeriodScore" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPeriodScore_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MatchPeriodScore_periodNumber_check" CHECK ("periodNumber" BETWEEN 1 AND 4),
    CONSTRAINT "MatchPeriodScore_homeScore_nonneg_check" CHECK ("homeScore" IS NULL OR "homeScore" >= 0),
    CONSTRAINT "MatchPeriodScore_awayScore_nonneg_check" CHECK ("awayScore" IS NULL OR "awayScore" >= 0)
);

-- CreateIndex
CREATE INDEX "MatchPeriodScore_eventId_idx" ON "MatchPeriodScore"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPeriodScore_eventId_periodNumber_key" ON "MatchPeriodScore"("eventId", "periodNumber");

-- AddForeignKey
ALTER TABLE "MatchPeriodScore" ADD CONSTRAINT "MatchPeriodScore_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
