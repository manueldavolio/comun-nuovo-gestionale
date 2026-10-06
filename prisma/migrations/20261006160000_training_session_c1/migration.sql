-- Release C1: TrainingExercise (libreria) + TrainingSession + TrainingSessionItem (snapshot)

CREATE TABLE "TrainingExercise" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMin" INTEGER,
    "materials" TEXT,
    "categoryId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingExercise_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrainingSessionItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exerciseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMin" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSessionItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrainingSession_eventId_key" ON "TrainingSession"("eventId");

CREATE INDEX "TrainingExercise_categoryId_idx" ON "TrainingExercise"("categoryId");
CREATE INDEX "TrainingExercise_createdById_idx" ON "TrainingExercise"("createdById");
CREATE INDEX "TrainingExercise_createdAt_idx" ON "TrainingExercise"("createdAt");
CREATE INDEX "TrainingSession_createdById_idx" ON "TrainingSession"("createdById");
CREATE INDEX "TrainingSessionItem_sessionId_sortOrder_idx" ON "TrainingSessionItem"("sessionId", "sortOrder");
CREATE INDEX "TrainingSessionItem_exerciseId_idx" ON "TrainingSessionItem"("exerciseId");

ALTER TABLE "TrainingExercise" ADD CONSTRAINT "TrainingExercise_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TrainingExercise" ADD CONSTRAINT "TrainingExercise_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrainingSessionItem" ADD CONSTRAINT "TrainingSessionItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingSessionItem" ADD CONSTRAINT "TrainingSessionItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "TrainingExercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;
