import path from "node:path";
import type { AuditCliOptions, BucketResolution } from "./types";

export const DEFAULT_ENROLLMENT_DOCUMENTS_BUCKET = "enrollment-documents";
export const DEFAULT_MEDICAL_VISITS_BUCKET = "medical-visit-certificates";
export const DEFAULT_SITE_IMAGES_BUCKET = "site-images";

export const FUNDAMENTAL_MODELS = [
  "User",
  "Athlete",
  "Enrollment",
  "Payment",
  "Receipt",
] as const;

export const ALL_AUDIT_MODELS = [
  "User",
  "ParentProfile",
  "CoachProfile",
  "AdminProfile",
  "Category",
  "Athlete",
  "CoachCategoryAssignment",
  "Enrollment",
  "EnrollmentDocument",
  "Payment",
  "Receipt",
  "ReceiptCounter",
  "AccountingEntry",
  "Event",
  "Convocation",
  "ConvocationAthlete",
  "Attendance",
  "MedicalVisit",
  "Document",
  "Announcement",
  "MediaItem",
  "MonthlyCoachReport",
  "Evaluation",
  "SitePlayer",
  "SiteStaffMember",
  "SiteNews",
  "SiteSponsor",
  "SiteGalleryAlbum",
  "SiteGalleryImage",
  "SiteVideo",
  "SiteSettings",
  "StripeWebhookEvent",
] as const;

export const KNOWN_USER_ROLES = ["ADMIN", "PARENT", "COACH", "YOUTH_DIRECTOR"] as const;

export const LOCAL_FALLBACK_DIRS = [
  "public/receipts",
  "storage/receipts",
  "storage/medical-visits",
] as const;

export function resolveProjectRoot(): string {
  return process.cwd();
}

export function resolveDefaultOutDir(projectRoot = resolveProjectRoot()): string {
  return path.join(projectRoot, "audit-output");
}

export function parseCliArgs(argv: string[]): AuditCliOptions {
  const args = [...argv];
  let outDir = resolveDefaultOutDir();
  let skipStorage = false;
  let skipDatabase = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--out" && args[i + 1]) {
      outDir = path.resolve(args[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--skip-storage") {
      skipStorage = true;
      continue;
    }
    if (arg === "--skip-database") {
      skipDatabase = true;
    }
  }

  return { outDir, skipStorage, skipDatabase };
}

export type EnvLike = Record<string, string | undefined>;

export function resolveEnrollmentDocumentsBucket(env: EnvLike = process.env): BucketResolution {
  const fromEnv = env.SUPABASE_ENROLLMENT_DOCUMENTS_BUCKET?.trim();
  const bucket = fromEnv || DEFAULT_ENROLLMENT_DOCUMENTS_BUCKET;
  return {
    domain: "enrollmentDocuments",
    bucket,
    sourceEnv: fromEnv ? "SUPABASE_ENROLLMENT_DOCUMENTS_BUCKET" : "default:enrollment-documents",
    configured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function resolveMedicalCertificatesBucket(env: EnvLike = process.env): BucketResolution {
  const fromEnv = env.SUPABASE_MEDICAL_VISITS_BUCKET?.trim();
  const bucket = fromEnv || DEFAULT_MEDICAL_VISITS_BUCKET;
  return {
    domain: "medicalCertificates",
    bucket,
    sourceEnv: fromEnv ? "SUPABASE_MEDICAL_VISITS_BUCKET" : "default:medical-visit-certificates",
    configured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

/**
 * Same resolution order as src/lib/receipt-storage.ts:
 * SUPABASE_RECEIPTS_BUCKET ?? SUPABASE_MEDICAL_VISITS_BUCKET ?? medical-visit-certificates
 */
export function resolveReceiptsBucket(env: EnvLike = process.env): BucketResolution {
  const receipts = env.SUPABASE_RECEIPTS_BUCKET?.trim();
  const medical = env.SUPABASE_MEDICAL_VISITS_BUCKET?.trim();
  if (receipts) {
    return {
      domain: "receipts",
      bucket: receipts,
      sourceEnv: "SUPABASE_RECEIPTS_BUCKET",
      configured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    };
  }
  if (medical) {
    return {
      domain: "receipts",
      bucket: medical,
      sourceEnv: "SUPABASE_MEDICAL_VISITS_BUCKET (fallback)",
      configured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
    };
  }
  return {
    domain: "receipts",
    bucket: DEFAULT_MEDICAL_VISITS_BUCKET,
    sourceEnv: "default:medical-visit-certificates",
    configured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function resolveSiteImagesBucket(env: EnvLike = process.env): BucketResolution {
  const fromEnv = env.SUPABASE_SITE_IMAGES_BUCKET?.trim();
  return {
    domain: "siteImages",
    bucket: fromEnv || DEFAULT_SITE_IMAGES_BUCKET,
    sourceEnv: fromEnv ? "SUPABASE_SITE_IMAGES_BUCKET" : "default:site-images",
    configured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export function resolveAllBuckets(env: EnvLike = process.env): BucketResolution[] {
  return [
    resolveEnrollmentDocumentsBucket(env),
    resolveMedicalCertificatesBucket(env),
    resolveReceiptsBucket(env),
    resolveSiteImagesBucket(env),
  ];
}

export function isSupabaseStorageConfigured(env: EnvLike = process.env): boolean {
  return Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function maskEnvPresence(env: EnvLike = process.env): Record<string, boolean> {
  return {
    DATABASE_URL: Boolean(env.DATABASE_URL?.trim()),
    SUPABASE_URL: Boolean(env.SUPABASE_URL?.trim()),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
    SUPABASE_ENROLLMENT_DOCUMENTS_BUCKET: Boolean(env.SUPABASE_ENROLLMENT_DOCUMENTS_BUCKET?.trim()),
    SUPABASE_MEDICAL_VISITS_BUCKET: Boolean(env.SUPABASE_MEDICAL_VISITS_BUCKET?.trim()),
    SUPABASE_RECEIPTS_BUCKET: Boolean(env.SUPABASE_RECEIPTS_BUCKET?.trim()),
    SUPABASE_SITE_IMAGES_BUCKET: Boolean(env.SUPABASE_SITE_IMAGES_BUCKET?.trim()),
  };
}
