-- CMS Sito Web pubblico (sezione admin "Sito web")

-- CreateEnum
CREATE TYPE "SiteTeam" AS ENUM ('PRIMA_SQUADRA', 'FEMMINILE', 'UNDER_19', 'UNDER_17', 'UNDER_15', 'CALCIO_A_5_C2');

-- CreateEnum
CREATE TYPE "SitePlayerRole" AS ENUM ('PORTIERE', 'DIFENSORE', 'CENTROCAMPISTA', 'ATTACCANTE');

-- CreateEnum
CREATE TYPE "SiteSponsorCategory" AS ENUM ('MAIN', 'GOLD', 'PARTNER', 'TECHNICAL');

-- CreateTable
CREATE TABLE "SitePlayer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "SitePlayerRole" NOT NULL,
    "team" "SiteTeam" NOT NULL DEFAULT 'PRIMA_SQUADRA',
    "shirtNumber" INTEGER,
    "description" TEXT,
    "photoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SitePlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteStaffMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Dirigenza',
    "description" TEXT,
    "photoUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteStaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteNews" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "content" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "category" TEXT NOT NULL DEFAULT 'Società',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteNews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSponsor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SiteSponsorCategory" NOT NULL DEFAULT 'PARTNER',
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteGalleryAlbum" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteGalleryAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteGalleryImage" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SiteGalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "youtubeUrl" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "foundationYear" INTEGER NOT NULL DEFAULT 1968,
    "teamsCount" TEXT NOT NULL DEFAULT '8',
    "membersCount" TEXT NOT NULL DEFAULT '200+',
    "fieldsCount" TEXT NOT NULL DEFAULT '4',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SitePlayer_team_isVisible_idx" ON "SitePlayer"("team", "isVisible");

-- CreateIndex
CREATE INDEX "SiteStaffMember_category_isVisible_idx" ON "SiteStaffMember"("category", "isVisible");

-- CreateIndex
CREATE UNIQUE INDEX "SiteNews_slug_key" ON "SiteNews"("slug");

-- CreateIndex
CREATE INDEX "SiteNews_published_publishedAt_idx" ON "SiteNews"("published", "publishedAt");

-- CreateIndex
CREATE INDEX "SiteSponsor_category_isVisible_idx" ON "SiteSponsor"("category", "isVisible");

-- CreateIndex
CREATE INDEX "SiteGalleryImage_albumId_idx" ON "SiteGalleryImage"("albumId");

-- AddForeignKey
ALTER TABLE "SiteGalleryImage" ADD CONSTRAINT "SiteGalleryImage_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "SiteGalleryAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
