export type Severity = "BLOCKING" | "WARNING" | "INFO";

export type AuditVerdict =
  | "READY_FOR_EXPORT"
  | "READY_FOR_EXPORT_WITH_WARNINGS"
  | "BLOCKED";

export type PasswordHashClass =
  | "BCRYPT_VALID_FORMAT"
  | "BCRYPT_MALFORMED"
  | "EMPTY_OR_NULL"
  | "SCRYPT"
  | "ARGON2"
  | "UNKNOWN";

export type StorageDomain =
  | "ENROLLMENT_DOCUMENT"
  | "MEDICAL_CERTIFICATE"
  | "RECEIPT"
  | "SITE_MEDIA"
  | "UNKNOWN";

export type StorageSource = "SUPABASE" | "LOCAL";

export type ReferenceStatus =
  | "FOUND_SUPABASE"
  | "FOUND_LOCAL_FALLBACK"
  | "MISSING"
  | "INVALID_PATH"
  | "DUPLICATE_REFERENCE"
  | "EMPTY_REFERENCE"
  | "BUCKET_NOT_CONFIGURED";

export type ModelCountStatus = "OK" | "ERROR";

export type AuditIssue = {
  code: string;
  severity: Severity;
  message: string;
  model?: string;
  recordIds?: string[];
  details?: Record<string, string | number | boolean | null>;
};

export type ModelCount = {
  model: string;
  count: number | null;
  status: ModelCountStatus;
  error?: string;
};

export type PasswordAuditSummary = {
  totalUsers: number;
  bcryptImportable: number;
  bcryptMalformed: number;
  emptyOrNull: number;
  scrypt: number;
  argon2: number;
  unknown: number;
  resetRequired: number;
  costFactorDistribution: Record<string, number>;
  problematicUserIds: {
    bcryptMalformed: string[];
    emptyOrNull: string[];
    unknown: string[];
    scrypt: string[];
    argon2: string[];
  };
};

export type StorageObjectRecord = {
  bucket: string;
  path: string;
  name: string;
  sizeBytes: number | null;
  mimeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  etag: string | null;
  source: StorageSource;
  domain: StorageDomain;
};

export type FileReferenceRecord = {
  model: string;
  recordId: string;
  field: string;
  bucket: string | null;
  path: string | null;
  status: ReferenceStatus;
  matchedLocalPath?: string | null;
  extraIds?: string[];
};

export type BucketResolution = {
  domain: "enrollmentDocuments" | "medicalCertificates" | "receipts" | "siteImages";
  bucket: string | null;
  sourceEnv: string;
  configured: boolean;
};

export type StorageAuditMeta = {
  configured: boolean;
  reachable: boolean;
  skippedReason?: string;
  buckets: BucketResolution[];
  listErrors: string[];
};

export type DatabaseAuditMeta = {
  reachable: boolean;
  fundamentalReadable: boolean;
  error?: string;
};

export type AuditReport = {
  generatedAt: string;
  verdict: AuditVerdict;
  exitCode: 0 | 1 | 2;
  environment: {
    database: DatabaseAuditMeta;
    storage: StorageAuditMeta;
  };
  counts: ModelCount[];
  password: PasswordAuditSummary;
  issues: AuditIssue[];
  references: {
    total: number;
    withPath: number;
    withoutPath: number;
    byStatus: Record<ReferenceStatus, number>;
    items: FileReferenceRecord[];
  };
  storage: {
    objects: StorageObjectRecord[];
    unreferencedCount: number;
    duplicatePaths: string[];
    zeroByteCount: number;
    unexpectedExtensionCount: number;
  };
  localFallbacks: {
    scannedDirs: string[];
    objects: StorageObjectRecord[];
    missingDirs: string[];
  };
  summary: {
    blocking: number;
    warning: number;
    info: number;
  };
};

export type AuditCliOptions = {
  outDir: string;
  skipStorage: boolean;
  skipDatabase: boolean;
};
