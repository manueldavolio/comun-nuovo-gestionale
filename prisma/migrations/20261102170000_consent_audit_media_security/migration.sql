-- Additive only: consent audit, legal documents, media subjects, auth rate limit.
-- Does NOT modify historical privacyConsent/regulationConsent/imageConsent values.
-- Does NOT invent timestamps/versions for legacy enrollments.

CREATE TYPE "LegalDocumentKind" AS ENUM ('PRIVACY_NOTICE', 'SOCIETY_REGULATION', 'IMAGE_MEDIA_CONSENT');
CREATE TYPE "ConsentAuditStatus" AS ENUM ('COMPLETE', 'LEGACY_UNAVAILABLE');
CREATE TYPE "MediaReviewStatus" AS ENUM ('DRAFT', 'READY', 'NEEDS_REVIEW', 'BLOCKED_CONSENT');

ALTER TABLE "Enrollment"
ADD COLUMN "privacyNoticeVersion" TEXT,
ADD COLUMN "privacyNoticeContentSha256" TEXT,
ADD COLUMN "privacyNoticeAcknowledgedAt" TIMESTAMP(3),
ADD COLUMN "regulationVersion" TEXT,
ADD COLUMN "regulationContentSha256" TEXT,
ADD COLUMN "regulationAcceptedAt" TIMESTAMP(3),
ADD COLUMN "imageConsentVersion" TEXT,
ADD COLUMN "imageConsentContentSha256" TEXT,
ADD COLUMN "imageConsentRecordedAt" TIMESTAMP(3),
ADD COLUMN "consentAuditStatus" "ConsentAuditStatus";

CREATE INDEX "Enrollment_consentAuditStatus_idx" ON "Enrollment"("consentAuditStatus");

-- Mark existing enrollments as legacy (no invented versions/dates).
UPDATE "Enrollment"
SET "consentAuditStatus" = 'LEGACY_UNAVAILABLE'
WHERE "consentAuditStatus" IS NULL
  AND "privacyNoticeVersion" IS NULL
  AND "regulationVersion" IS NULL
  AND "imageConsentVersion" IS NULL;

ALTER TABLE "MediaItem"
ADD COLUMN "subjectsDeclaredComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reviewStatus" "MediaReviewStatus" NOT NULL DEFAULT 'NEEDS_REVIEW';

CREATE INDEX "MediaItem_reviewStatus_idx" ON "MediaItem"("reviewStatus");

-- Existing published media require manual subject/consent review (no auto-delete).
UPDATE "MediaItem"
SET "reviewStatus" = 'NEEDS_REVIEW',
    "subjectsDeclaredComplete" = false
WHERE "publishedAt" IS NOT NULL;

CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "kind" "LegalDocumentKind" NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalDocument_kind_version_key" ON "LegalDocument"("kind", "version");
CREATE INDEX "LegalDocument_kind_isCurrent_idx" ON "LegalDocument"("kind", "isCurrent");

CREATE TABLE "AthleteImageConsentEvent" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "documentContentSha256" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actedByUserId" TEXT NOT NULL,
    "source" TEXT,
    "note" TEXT,
    CONSTRAINT "AthleteImageConsentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AthleteImageConsentEvent_athleteId_recordedAt_idx" ON "AthleteImageConsentEvent"("athleteId", "recordedAt");
CREATE INDEX "AthleteImageConsentEvent_actedByUserId_idx" ON "AthleteImageConsentEvent"("actedByUserId");

ALTER TABLE "AthleteImageConsentEvent"
ADD CONSTRAINT "AthleteImageConsentEvent_athleteId_fkey"
FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AthleteImageConsentEvent"
ADD CONSTRAINT "AthleteImageConsentEvent_actedByUserId_fkey"
FOREIGN KEY ("actedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MediaItemSubject" (
    "id" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaItemSubject_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaItemSubject_mediaItemId_athleteId_key" ON "MediaItemSubject"("mediaItemId", "athleteId");
CREATE INDEX "MediaItemSubject_athleteId_idx" ON "MediaItemSubject"("athleteId");

ALTER TABLE "MediaItemSubject"
ADD CONSTRAINT "MediaItemSubject_mediaItemId_fkey"
FOREIGN KEY ("mediaItemId") REFERENCES "MediaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MediaItemSubject"
ADD CONSTRAINT "MediaItemSubject_athleteId_fkey"
FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AuthRateLimitBucket" (
    "id" TEXT NOT NULL,
    "bucketKey" TEXT NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthRateLimitBucket_bucketKey_key" ON "AuthRateLimitBucket"("bucketKey");
