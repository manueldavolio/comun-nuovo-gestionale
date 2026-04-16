-- CreateTable
CREATE TABLE "CoachCategoryAssignment" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachCategoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachCategoryAssignment_coachId_categoryId_key" ON "CoachCategoryAssignment"("coachId", "categoryId");

-- CreateIndex
CREATE INDEX "CoachCategoryAssignment_categoryId_idx" ON "CoachCategoryAssignment"("categoryId");

-- AddForeignKey
ALTER TABLE "CoachCategoryAssignment" ADD CONSTRAINT "CoachCategoryAssignment_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "CoachProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachCategoryAssignment" ADD CONSTRAINT "CoachCategoryAssignment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
