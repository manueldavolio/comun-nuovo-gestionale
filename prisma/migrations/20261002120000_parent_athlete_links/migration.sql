-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ParentAthleteLinkRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "AthleteParent" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteParent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentAthleteLinkRequest" (
    "id" TEXT NOT NULL,
    "requesterParentId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "status" "ParentAthleteLinkRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentAthleteLinkRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AthleteParent_athleteId_parentId_key" ON "AthleteParent"("athleteId", "parentId");

-- CreateIndex
CREATE INDEX "AthleteParent_parentId_idx" ON "AthleteParent"("parentId");

-- CreateIndex
CREATE INDEX "AthleteParent_athleteId_idx" ON "AthleteParent"("athleteId");

-- CreateIndex
CREATE INDEX "ParentAthleteLinkRequest_status_createdAt_idx" ON "ParentAthleteLinkRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ParentAthleteLinkRequest_requesterParentId_athleteId_idx" ON "ParentAthleteLinkRequest"("requesterParentId", "athleteId");

-- CreateIndex
CREATE INDEX "ParentAthleteLinkRequest_athleteId_idx" ON "ParentAthleteLinkRequest"("athleteId");

-- At most one PENDING request per (requester, athlete)
CREATE UNIQUE INDEX "ParentAthleteLinkRequest_pending_unique"
ON "ParentAthleteLinkRequest"("requesterParentId", "athleteId")
WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "AthleteParent" ADD CONSTRAINT "AthleteParent_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteParent" ADD CONSTRAINT "AthleteParent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAthleteLinkRequest" ADD CONSTRAINT "ParentAthleteLinkRequest_requesterParentId_fkey" FOREIGN KEY ("requesterParentId") REFERENCES "ParentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAthleteLinkRequest" ADD CONSTRAINT "ParentAthleteLinkRequest_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAthleteLinkRequest" ADD CONSTRAINT "ParentAthleteLinkRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
