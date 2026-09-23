-- AlterTable
-- Nullable additive column: existing convocations keep working without backfill.
ALTER TABLE "Convocation" ADD COLUMN "meetingAt" TIMESTAMP(3);
