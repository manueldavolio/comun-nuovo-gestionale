import { getPathBasename, normalizeReceiptObjectPath, normalizeStoragePath } from "../mask";
import type {
  AuditIssue,
  FileReferenceRecord,
  ReferenceStatus,
  StorageObjectRecord,
} from "../types";

export type DbFileRefInput = {
  enrollmentDocuments: Array<{ id: string; filePath: string | null }>;
  medicalVisits: Array<{ id: string; certificateFilePath: string | null }>;
  receipts: Array<{ id: string; filePath: string | null; receiptNumber: string }>;
};

export type BucketNames = {
  enrollmentDocuments: string | null;
  medicalCertificates: string | null;
  receipts: string | null;
  storageConfigured: boolean;
};

function keyOf(bucket: string, path: string): string {
  return `${bucket}::${normalizeStoragePath(path)}`;
}

function buildSupabaseIndex(objects: StorageObjectRecord[]): Set<string> {
  const set = new Set<string>();
  for (const obj of objects) {
    if (obj.source !== "SUPABASE") continue;
    set.add(keyOf(obj.bucket, obj.path));
  }
  return set;
}

function buildLocalIndex(objects: StorageObjectRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const obj of objects) {
    if (obj.source !== "LOCAL") continue;
    map.set(normalizeStoragePath(obj.path), obj.path);
    map.set(getPathBasename(obj.path), obj.path);
    // Also index receipts/basename and medical-visits/basename shapes
    if (obj.path.includes("receipts/")) {
      map.set(`receipts/${getPathBasename(obj.path)}`, obj.path);
    }
    if (obj.path.includes("medical-visits/")) {
      map.set(`medical-visits/${getPathBasename(obj.path)}`, obj.path);
    }
  }
  return map;
}

export function matchFileReferences(params: {
  db: DbFileRefInput;
  buckets: BucketNames;
  supabaseObjects: StorageObjectRecord[];
  localObjects: StorageObjectRecord[];
}): {
  references: FileReferenceRecord[];
  issues: AuditIssue[];
  unreferencedStorage: StorageObjectRecord[];
  stats: {
    total: number;
    withPath: number;
    withoutPath: number;
    byStatus: Record<ReferenceStatus, number>;
  };
} {
  const supabaseIndex = buildSupabaseIndex(params.supabaseObjects);
  const localIndex = buildLocalIndex(params.localObjects);
  const referencedKeys = new Set<string>();
  const references: FileReferenceRecord[] = [];
  const issues: AuditIssue[] = [];
  const pathOwners = new Map<string, string[]>();

  const byStatus: Record<ReferenceStatus, number> = {
    FOUND_SUPABASE: 0,
    FOUND_LOCAL_FALLBACK: 0,
    MISSING: 0,
    INVALID_PATH: 0,
    DUPLICATE_REFERENCE: 0,
    EMPTY_REFERENCE: 0,
    BUCKET_NOT_CONFIGURED: 0,
  };

  function trackOwner(model: string, id: string, path: string) {
    const key = `${model}:${normalizeStoragePath(path)}`;
    const list = pathOwners.get(key) ?? [];
    list.push(id);
    pathOwners.set(key, list);
  }

  function pushRef(ref: FileReferenceRecord) {
    references.push(ref);
    byStatus[ref.status] += 1;
  }

  // Enrollment documents
  for (const doc of params.db.enrollmentDocuments) {
    trackOwner("EnrollmentDocument", doc.id, doc.filePath ?? "");
    if (!doc.filePath || !doc.filePath.trim()) {
      pushRef({
        model: "EnrollmentDocument",
        recordId: doc.id,
        field: "filePath",
        bucket: params.buckets.enrollmentDocuments,
        path: null,
        status: "EMPTY_REFERENCE",
      });
      issues.push({
        code: "ENROLLMENT_DOCUMENT_EMPTY_PATH",
        severity: "BLOCKING",
        message: "EnrollmentDocument.filePath is empty.",
        model: "EnrollmentDocument",
        recordIds: [doc.id],
      });
      continue;
    }

    const path = normalizeStoragePath(doc.filePath);
    if (path.includes("..")) {
      pushRef({
        model: "EnrollmentDocument",
        recordId: doc.id,
        field: "filePath",
        bucket: params.buckets.enrollmentDocuments,
        path,
        status: "INVALID_PATH",
      });
      issues.push({
        code: "ENROLLMENT_DOCUMENT_INVALID_PATH",
        severity: "BLOCKING",
        message: "EnrollmentDocument.filePath is invalid.",
        model: "EnrollmentDocument",
        recordIds: [doc.id],
      });
      continue;
    }

    if (!params.buckets.storageConfigured || !params.buckets.enrollmentDocuments) {
      pushRef({
        model: "EnrollmentDocument",
        recordId: doc.id,
        field: "filePath",
        bucket: params.buckets.enrollmentDocuments,
        path,
        status: "BUCKET_NOT_CONFIGURED",
      });
      continue;
    }

    const bucket = params.buckets.enrollmentDocuments;
    const found = supabaseIndex.has(keyOf(bucket, path));
    if (found) {
      referencedKeys.add(keyOf(bucket, path));
      pushRef({
        model: "EnrollmentDocument",
        recordId: doc.id,
        field: "filePath",
        bucket,
        path,
        status: "FOUND_SUPABASE",
      });
    } else {
      pushRef({
        model: "EnrollmentDocument",
        recordId: doc.id,
        field: "filePath",
        bucket,
        path,
        status: "MISSING",
      });
      issues.push({
        code: "ENROLLMENT_DOCUMENT_FILE_MISSING",
        severity: "BLOCKING",
        message: "EnrollmentDocument.filePath not found in Supabase Storage.",
        model: "EnrollmentDocument",
        recordIds: [doc.id],
        details: { path },
      });
    }
  }

  // Medical visits
  for (const visit of params.db.medicalVisits) {
    if (!visit.certificateFilePath || !visit.certificateFilePath.trim()) {
      pushRef({
        model: "MedicalVisit",
        recordId: visit.id,
        field: "certificateFilePath",
        bucket: params.buckets.medicalCertificates,
        path: null,
        status: "EMPTY_REFERENCE",
      });
      // Optional certificate → INFO only
      issues.push({
        code: "MEDICAL_VISIT_NO_CERTIFICATE",
        severity: "INFO",
        message: "MedicalVisit without certificateFilePath.",
        model: "MedicalVisit",
        recordIds: [visit.id],
      });
      continue;
    }

    const path = normalizeStoragePath(visit.certificateFilePath);
    trackOwner("MedicalVisit", visit.id, path);

    if (path.includes("..")) {
      pushRef({
        model: "MedicalVisit",
        recordId: visit.id,
        field: "certificateFilePath",
        bucket: params.buckets.medicalCertificates,
        path,
        status: "INVALID_PATH",
      });
      issues.push({
        code: "MEDICAL_VISIT_INVALID_PATH",
        severity: "BLOCKING",
        message: "MedicalVisit.certificateFilePath is invalid.",
        model: "MedicalVisit",
        recordIds: [visit.id],
      });
      continue;
    }

    const bucket = params.buckets.medicalCertificates;
    if (params.buckets.storageConfigured && bucket && supabaseIndex.has(keyOf(bucket, path))) {
      referencedKeys.add(keyOf(bucket, path));
      pushRef({
        model: "MedicalVisit",
        recordId: visit.id,
        field: "certificateFilePath",
        bucket,
        path,
        status: "FOUND_SUPABASE",
      });
      continue;
    }

    const localHit =
      localIndex.get(path) ??
      localIndex.get(getPathBasename(path)) ??
      localIndex.get(`medical-visits/${getPathBasename(path)}`);
    if (localHit) {
      pushRef({
        model: "MedicalVisit",
        recordId: visit.id,
        field: "certificateFilePath",
        bucket,
        path,
        status: "FOUND_LOCAL_FALLBACK",
        matchedLocalPath: localHit,
      });
      continue;
    }

    if (!params.buckets.storageConfigured) {
      pushRef({
        model: "MedicalVisit",
        recordId: visit.id,
        field: "certificateFilePath",
        bucket,
        path,
        status: "BUCKET_NOT_CONFIGURED",
      });
      continue;
    }

    pushRef({
      model: "MedicalVisit",
      recordId: visit.id,
      field: "certificateFilePath",
      bucket,
      path,
      status: "MISSING",
    });
    issues.push({
      code: "MEDICAL_VISIT_FILE_MISSING",
      severity: "BLOCKING",
      message: "MedicalVisit.certificateFilePath not found in Storage or local fallback.",
      model: "MedicalVisit",
      recordIds: [visit.id],
      details: { path },
    });
  }

  // Receipts
  for (const receipt of params.db.receipts) {
    if (!receipt.filePath || !receipt.filePath.trim()) {
      pushRef({
        model: "Receipt",
        recordId: receipt.id,
        field: "filePath",
        bucket: params.buckets.receipts,
        path: null,
        status: "EMPTY_REFERENCE",
      });
      issues.push({
        code: "RECEIPT_FILE_EMPTY",
        severity: "BLOCKING",
        message: "Receipt.filePath missing (PDF expected).",
        model: "Receipt",
        recordIds: [receipt.id],
        details: { receiptNumber: receipt.receiptNumber },
      });
      continue;
    }

    const path = normalizeReceiptObjectPath(receipt.filePath);
    trackOwner("Receipt", receipt.id, path);

    if (path.includes("..")) {
      pushRef({
        model: "Receipt",
        recordId: receipt.id,
        field: "filePath",
        bucket: params.buckets.receipts,
        path,
        status: "INVALID_PATH",
      });
      issues.push({
        code: "RECEIPT_INVALID_PATH",
        severity: "BLOCKING",
        message: "Receipt.filePath is invalid.",
        model: "Receipt",
        recordIds: [receipt.id],
      });
      continue;
    }

    const bucket = params.buckets.receipts;
    if (params.buckets.storageConfigured && bucket && supabaseIndex.has(keyOf(bucket, path))) {
      referencedKeys.add(keyOf(bucket, path));
      pushRef({
        model: "Receipt",
        recordId: receipt.id,
        field: "filePath",
        bucket,
        path,
        status: "FOUND_SUPABASE",
      });
      continue;
    }

    const localHit =
      localIndex.get(path) ??
      localIndex.get(getPathBasename(path)) ??
      localIndex.get(`receipts/${getPathBasename(path)}`) ??
      localIndex.get(`public/receipts/${getPathBasename(path)}`);
    if (localHit) {
      pushRef({
        model: "Receipt",
        recordId: receipt.id,
        field: "filePath",
        bucket,
        path,
        status: "FOUND_LOCAL_FALLBACK",
        matchedLocalPath: localHit,
      });
      continue;
    }

    if (!params.buckets.storageConfigured) {
      pushRef({
        model: "Receipt",
        recordId: receipt.id,
        field: "filePath",
        bucket,
        path,
        status: "BUCKET_NOT_CONFIGURED",
      });
      continue;
    }

    pushRef({
      model: "Receipt",
      recordId: receipt.id,
      field: "filePath",
      bucket,
      path,
      status: "MISSING",
    });
    issues.push({
      code: "RECEIPT_FILE_MISSING",
      severity: "BLOCKING",
      message: "Receipt PDF not found in Storage or local fallback.",
      model: "Receipt",
      recordIds: [receipt.id],
      details: { path, receiptNumber: receipt.receiptNumber },
    });
  }

  for (const [key, ids] of pathOwners.entries()) {
    if (!key.endsWith(":") && ids.length > 1) {
      // skip empty path trackers
      const pathPart = key.split(":").slice(1).join(":");
      if (!pathPart) continue;
      issues.push({
        code: "FILE_REFERENCE_DUPLICATE",
        severity: "WARNING",
        message: "Multiple DB records share the same file path.",
        recordIds: ids.slice(0, 25),
        details: { key },
      });
      for (const ref of references) {
        if (ids.includes(ref.recordId) && ref.path && normalizeStoragePath(ref.path) === pathPart) {
          if (ref.status === "FOUND_SUPABASE" || ref.status === "FOUND_LOCAL_FALLBACK") {
            ref.status = "DUPLICATE_REFERENCE";
            byStatus.DUPLICATE_REFERENCE += 1;
          }
        }
      }
    }
  }

  const unreferencedStorage = params.supabaseObjects.filter((obj) => {
    if (obj.domain === "SITE_MEDIA") return false; // CMS optional for core migration
    const k = keyOf(obj.bucket, obj.path);
    return !referencedKeys.has(k);
  });

  if (unreferencedStorage.length) {
    issues.push({
      code: "STORAGE_UNREFERENCED_OBJECTS",
      severity: "WARNING",
      message: "Supabase Storage objects not referenced by core DB file fields.",
      details: { count: unreferencedStorage.length },
    });
  }

  const withPath = references.filter((r) => r.path).length;
  const withoutPath = references.length - withPath;

  return {
    references,
    issues,
    unreferencedStorage,
    stats: {
      total: references.length,
      withPath,
      withoutPath,
      byStatus,
    },
  };
}
