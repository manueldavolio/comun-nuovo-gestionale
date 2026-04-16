-- Align Enrollment defaults with prisma/schema.prisma
ALTER TABLE "Enrollment"
ALTER COLUMN "receiptFirstName" DROP DEFAULT,
ALTER COLUMN "receiptLastName" DROP DEFAULT,
ALTER COLUMN "receiptTaxCode" DROP DEFAULT,
ALTER COLUMN "receiptPhone" DROP DEFAULT,
ALTER COLUMN "receiptAddress" DROP DEFAULT,
ALTER COLUMN "receiptCity" DROP DEFAULT,
ALTER COLUMN "receiptPostalCode" DROP DEFAULT,
ALTER COLUMN "receiptProvince" DROP DEFAULT,
ALTER COLUMN "receiptEmail" DROP DEFAULT,
ALTER COLUMN "privacyConsent" DROP DEFAULT,
ALTER COLUMN "regulationConsent" DROP DEFAULT;
