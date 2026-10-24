-- CreateEnum
CREATE TYPE "SocialGraphicTemplate" AS ENUM ('MATCHDAY', 'FULL_TIME', 'NEXT_MATCH');

-- CreateEnum
CREATE TYPE "SocialGraphicFormat" AS ENUM ('SQUARE_1080', 'PORTRAIT_1080x1350');

-- CreateEnum
CREATE TYPE "SocialGraphicStatus" AS ENUM ('DRAFT', 'EXPORTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SocialAssetKind" AS ENUM ('OPPONENT_LOGO', 'BACKGROUND', 'CLUB_LOGO');

-- CreateTable
CREATE TABLE "SocialGraphic" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "template" "SocialGraphicTemplate" NOT NULL,
    "format" "SocialGraphicFormat" NOT NULL,
    "status" "SocialGraphicStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "overrides" JSONB NOT NULL,
    "previewPath" TEXT,
    "exportPath" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialGraphic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocialAsset" (
    "id" TEXT NOT NULL,
    "kind" "SocialAssetKind" NOT NULL,
    "label" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialGraphic_eventId_template_format_idx" ON "SocialGraphic"("eventId", "template", "format");

-- CreateIndex
CREATE INDEX "SocialGraphic_status_updatedAt_idx" ON "SocialGraphic"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SocialGraphic_createdById_idx" ON "SocialGraphic"("createdById");

-- CreateIndex
CREATE INDEX "SocialGraphic_updatedById_idx" ON "SocialGraphic"("updatedById");

-- CreateIndex
CREATE INDEX "SocialAsset_kind_label_idx" ON "SocialAsset"("kind", "label");

-- CreateIndex
CREATE INDEX "SocialAsset_createdById_idx" ON "SocialAsset"("createdById");

-- AddForeignKey
ALTER TABLE "SocialGraphic" ADD CONSTRAINT "SocialGraphic_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialGraphic" ADD CONSTRAINT "SocialGraphic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialGraphic" ADD CONSTRAINT "SocialGraphic_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialAsset" ADD CONSTRAINT "SocialAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
