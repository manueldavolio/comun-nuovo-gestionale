CREATE TYPE "ConvocationResponseStatus" AS ENUM ('PENDING', 'PRESENT', 'ABSENT');

CREATE TABLE "Convocation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "categoryId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Convocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConvocationAthlete" (
    "id" TEXT NOT NULL,
    "convocationId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "responseStatus" "ConvocationResponseStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConvocationAthlete_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Convocation_eventId_key" ON "Convocation"("eventId");
CREATE INDEX "Convocation_categoryId_createdAt_idx" ON "Convocation"("categoryId", "createdAt");
CREATE INDEX "Convocation_createdById_idx" ON "Convocation"("createdById");
CREATE UNIQUE INDEX "ConvocationAthlete_convocationId_athleteId_key" ON "ConvocationAthlete"("convocationId", "athleteId");
CREATE INDEX "ConvocationAthlete_athleteId_responseStatus_idx" ON "ConvocationAthlete"("athleteId", "responseStatus");

ALTER TABLE "Convocation"
ADD CONSTRAINT "Convocation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Convocation"
ADD CONSTRAINT "Convocation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Convocation"
ADD CONSTRAINT "Convocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConvocationAthlete"
ADD CONSTRAINT "ConvocationAthlete_convocationId_fkey" FOREIGN KEY ("convocationId") REFERENCES "Convocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConvocationAthlete"
ADD CONSTRAINT "ConvocationAthlete_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
