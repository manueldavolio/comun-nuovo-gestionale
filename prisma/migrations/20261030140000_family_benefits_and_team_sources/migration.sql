-- CreateEnum
CREATE TYPE "FamilyBenefitAudience" AS ENUM ('ALL', 'YOUTH', 'FIRST_TEAM', 'BASE_ACTIVITY');

-- CreateEnum
CREATE TYPE "CompetitionSourceType" AS ENUM ('NONE', 'TUTTOCAMPO', 'CRL_LND', 'MANUAL');

-- CreateTable
CREATE TABLE "FamilyBenefit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessName" TEXT,
    "description" TEXT NOT NULL,
    "discountLabel" TEXT,
    "promoCode" TEXT,
    "conditions" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "contactInfo" TEXT,
    "expiresAt" TIMESTAMP(3),
    "audience" "FamilyBenefitAudience" NOT NULL DEFAULT 'ALL',
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryCompetitionSource" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "seasonLabel" TEXT NOT NULL,
    "competitionName" TEXT NOT NULL,
    "groupLabel" TEXT,
    "sourceType" "CompetitionSourceType" NOT NULL DEFAULT 'NONE',
    "sourcePageUrl" TEXT,
    "widgetStandingsUrl" TEXT,
    "widgetResultsUrl" TEXT,
    "widgetNextMatchUrl" TEXT,
    "manualStandingsJson" TEXT,
    "sourceNotes" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastManualUpdateAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategoryCompetitionSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FamilyBenefit_isPublished_isActive_priority_sortOrder_idx" ON "FamilyBenefit"("isPublished", "isActive", "priority", "sortOrder");

-- CreateIndex
CREATE INDEX "FamilyBenefit_audience_idx" ON "FamilyBenefit"("audience");

-- CreateIndex
CREATE INDEX "FamilyBenefit_expiresAt_idx" ON "FamilyBenefit"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryCompetitionSource_categoryId_key" ON "CategoryCompetitionSource"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryCompetitionSource_seasonLabel_isActive_idx" ON "CategoryCompetitionSource"("seasonLabel", "isActive");

-- CreateIndex
CREATE INDEX "CategoryCompetitionSource_sourceType_idx" ON "CategoryCompetitionSource"("sourceType");

-- AddForeignKey
ALTER TABLE "CategoryCompetitionSource" ADD CONSTRAINT "CategoryCompetitionSource_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
