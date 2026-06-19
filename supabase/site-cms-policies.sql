-- ============================================================================
-- CMS SITO WEB — POLICY SUPABASE (RLS + STORAGE)
-- Da eseguire nel SQL Editor di Supabase DOPO aver creato le tabelle
-- (con la migration Prisma `20260611150000_site_cms_module` oppure con
-- `site-cms-schema.sql`).
--
-- Modello di sicurezza:
--   - SCRITTURE: solo dal gestionale (Prisma / service role, bypassa RLS).
--   - LETTURE:   il sito pubblico legge con la anon key, solo i contenuti
--                visibili/pubblicati.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) ROW LEVEL SECURITY sulle tabelle CMS
-- ---------------------------------------------------------------------------

ALTER TABLE "SitePlayer"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteStaffMember"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteNews"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteSponsor"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteGalleryAlbum" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteGalleryImage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteVideo"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteSettings"     ENABLE ROW LEVEL SECURITY;

-- Lettura pubblica (anon) dei soli contenuti visibili
DROP POLICY IF EXISTS "Public read site players" ON "SitePlayer";
CREATE POLICY "Public read site players"
  ON "SitePlayer" FOR SELECT
  TO anon, authenticated
  USING ("isVisible" = true);

DROP POLICY IF EXISTS "Public read site staff" ON "SiteStaffMember";
CREATE POLICY "Public read site staff"
  ON "SiteStaffMember" FOR SELECT
  TO anon, authenticated
  USING ("isVisible" = true);

-- News: pubbliche solo se pubblicate
DROP POLICY IF EXISTS "Public read published news" ON "SiteNews";
CREATE POLICY "Public read published news"
  ON "SiteNews" FOR SELECT
  TO anon, authenticated
  USING ("published" = true);

DROP POLICY IF EXISTS "Public read site sponsors" ON "SiteSponsor";
CREATE POLICY "Public read site sponsors"
  ON "SiteSponsor" FOR SELECT
  TO anon, authenticated
  USING ("isVisible" = true);

DROP POLICY IF EXISTS "Public read gallery albums" ON "SiteGalleryAlbum";
CREATE POLICY "Public read gallery albums"
  ON "SiteGalleryAlbum" FOR SELECT
  TO anon, authenticated
  USING ("isVisible" = true);

DROP POLICY IF EXISTS "Public read gallery images" ON "SiteGalleryImage";
CREATE POLICY "Public read gallery images"
  ON "SiteGalleryImage" FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "SiteGalleryAlbum" a
      WHERE a."id" = "SiteGalleryImage"."albumId" AND a."isVisible" = true
    )
  );

DROP POLICY IF EXISTS "Public read site videos" ON "SiteVideo";
CREATE POLICY "Public read site videos"
  ON "SiteVideo" FOR SELECT
  TO anon, authenticated
  USING ("isVisible" = true);

DROP POLICY IF EXISTS "Public read site settings" ON "SiteSettings";
CREATE POLICY "Public read site settings"
  ON "SiteSettings" FOR SELECT
  TO anon, authenticated
  USING (true);

-- Grant di lettura (PostgREST richiede anche i privilegi di base)
GRANT SELECT ON "SitePlayer", "SiteStaffMember", "SiteNews", "SiteSponsor",
  "SiteGalleryAlbum", "SiteGalleryImage", "SiteVideo", "SiteSettings"
  TO anon, authenticated;

-- Nessuna policy INSERT/UPDATE/DELETE: le scritture passano solo dal
-- gestionale (connessione Prisma / service role), che non è soggetto a RLS.

-- ---------------------------------------------------------------------------
-- 2) STORAGE: bucket pubblico "site-images"
-- ---------------------------------------------------------------------------

-- Crea il bucket pubblico (idempotente). In alternativa: Dashboard > Storage
-- > New bucket > nome "site-images" > Public bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-images', 'site-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Lettura pubblica dei file del bucket (i bucket pubblici servono i file via
-- /storage/v1/object/public/..., la policy esplicita copre anche l'API list).
DROP POLICY IF EXISTS "Public read site images" ON storage.objects;
CREATE POLICY "Public read site images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'site-images');

-- Nessuna policy di scrittura: gli upload avvengono solo dal gestionale con
-- la SERVICE_ROLE_KEY (bypassa RLS). La anon key NON può scrivere.
