-- ============================================================================
-- CMS SITO WEB — SCHEMA SUPABASE
-- Tabelle del sito pubblico ASD Comun Nuovo gestite dalla sezione admin
-- "Sito web" del gestionale.
--
-- NOTA: se usi Prisma (`npx prisma migrate deploy`) queste tabelle vengono
-- create dalla migration `20260611150000_site_cms_module` e questo file NON
-- va eseguito. Usalo solo se preferisci creare lo schema direttamente dal
-- SQL Editor di Supabase. Le istruzioni sono idempotenti.
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE "SiteTeam" AS ENUM ('PRIMA_SQUADRA', 'FEMMINILE', 'UNDER_19', 'UNDER_17', 'UNDER_15', 'CALCIO_A_5_C2');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SitePlayerRole" AS ENUM ('PORTIERE', 'DIFENSORE', 'CENTROCAMPISTA', 'ATTACCANTE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SiteSponsorCategory" AS ENUM ('MAIN', 'GOLD', 'PARTNER', 'TECHNICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Giocatori
CREATE TABLE IF NOT EXISTS "SitePlayer" (
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

-- Staff
CREATE TABLE IF NOT EXISTS "SiteStaffMember" (
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

-- News
CREATE TABLE IF NOT EXISTS "SiteNews" (
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

-- Sponsor
CREATE TABLE IF NOT EXISTS "SiteSponsor" (
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

-- Galleria: album
CREATE TABLE IF NOT EXISTS "SiteGalleryAlbum" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteGalleryAlbum_pkey" PRIMARY KEY ("id")
);

-- Galleria: immagini
CREATE TABLE IF NOT EXISTS "SiteGalleryImage" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "alt" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteGalleryImage_pkey" PRIMARY KEY ("id")
);

-- Video
CREATE TABLE IF NOT EXISTS "SiteVideo" (
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

-- Impostazioni sito (riga singola id = 'main')
CREATE TABLE IF NOT EXISTS "SiteSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "foundationYear" INTEGER NOT NULL DEFAULT 1968,
    "teamsCount" TEXT NOT NULL DEFAULT '8',
    "membersCount" TEXT NOT NULL DEFAULT '200+',
    "fieldsCount" TEXT NOT NULL DEFAULT '4',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
);

-- Indici
CREATE INDEX IF NOT EXISTS "SitePlayer_team_isVisible_idx" ON "SitePlayer"("team", "isVisible");
CREATE INDEX IF NOT EXISTS "SiteStaffMember_category_isVisible_idx" ON "SiteStaffMember"("category", "isVisible");
CREATE UNIQUE INDEX IF NOT EXISTS "SiteNews_slug_key" ON "SiteNews"("slug");
CREATE INDEX IF NOT EXISTS "SiteNews_published_publishedAt_idx" ON "SiteNews"("published", "publishedAt");
CREATE INDEX IF NOT EXISTS "SiteSponsor_category_isVisible_idx" ON "SiteSponsor"("category", "isVisible");
CREATE INDEX IF NOT EXISTS "SiteGalleryImage_albumId_idx" ON "SiteGalleryImage"("albumId");

-- Foreign key (album -> immagini, eliminazione a cascata)
DO $$ BEGIN
  ALTER TABLE "SiteGalleryImage"
    ADD CONSTRAINT "SiteGalleryImage_albumId_fkey"
    FOREIGN KEY ("albumId") REFERENCES "SiteGalleryAlbum"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
