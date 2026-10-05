-- MatchPlayerStat.goalsConceded: gol subiti portiere (nullable = non inserito; 0 = zero confermato).
-- ADDITIVA. NON eseguire automaticamente: applicare manualmente su Supabase dopo review.

-- AlterTable
ALTER TABLE "MatchPlayerStat" ADD COLUMN IF NOT EXISTS "goalsConceded" INTEGER;

-- Check: solo null oppure >= 0
ALTER TABLE "MatchPlayerStat" DROP CONSTRAINT IF EXISTS "MatchPlayerStat_goalsConceded_nonneg_check";
ALTER TABLE "MatchPlayerStat"
  ADD CONSTRAINT "MatchPlayerStat_goalsConceded_nonneg_check"
  CHECK ("goalsConceded" IS NULL OR "goalsConceded" >= 0);
