-- Image consent 1.1: dual purpose (INTERNAL / EXTERNAL), choice history, privacy ack.
-- Does NOT publish privacy notice 1.1.
-- Does NOT convert historical IMAGE_MEDIA_CONSENT 1.0 into INTERNAL/EXTERNAL grants.
-- Additive / nullable columns keep legacy AthleteImageConsentEvent rows valid.

CREATE TYPE "ImageConsentPurpose" AS ENUM ('INTERNAL', 'EXTERNAL');
CREATE TYPE "ImageConsentChoice" AS ENUM ('GRANTED', 'DENIED', 'DEFERRED');

ALTER TYPE "LegalDocumentKind" ADD VALUE 'IMAGE_CONSENT_INTERNAL';
ALTER TYPE "LegalDocumentKind" ADD VALUE 'IMAGE_CONSENT_EXTERNAL';

ALTER TABLE "AthleteImageConsentEvent"
ADD COLUMN "purpose" "ImageConsentPurpose",
ADD COLUMN "choice" "ImageConsentChoice",
ADD COLUMN "legalDocumentKind" "LegalDocumentKind";

CREATE INDEX "AthleteImageConsentEvent_athleteId_purpose_recordedAt_idx"
ON "AthleteImageConsentEvent"("athleteId", "purpose", "recordedAt");

CREATE TABLE "PrivacyNoticeAcknowledgement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "documentContentSha256" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    CONSTRAINT "PrivacyNoticeAcknowledgement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrivacyNoticeAcknowledgement_userId_documentVersion_key"
ON "PrivacyNoticeAcknowledgement"("userId", "documentVersion");

CREATE INDEX "PrivacyNoticeAcknowledgement_userId_acknowledgedAt_idx"
ON "PrivacyNoticeAcknowledgement"("userId", "acknowledgedAt");

ALTER TABLE "PrivacyNoticeAcknowledgement"
ADD CONSTRAINT "PrivacyNoticeAcknowledgement_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
