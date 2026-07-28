import type { PrismaClient } from "@prisma/client";
import { resolveAllBuckets, resolveProjectRoot, type EnvLike } from "./config";
import { auditDatabaseCounts } from "./database-audit";
import { summarizePasswordHashes } from "./password-audit";
import { auditRelations } from "./relation-audit";
import { createReadOnlyStorageClient } from "./storage/client";
import { analyzeStorageInventory, inventorySupabaseStorage } from "./storage/inventory";
import { inventoryLocalFallbacks } from "./storage/local-fallbacks";
import { matchFileReferences } from "./storage/references";
import {
  ensureOutDir,
  writeDatabaseCounts,
  writeJsonReport,
  writeStorageInventory,
} from "./report/json-report";
import { writeMarkdownReport } from "./report/markdown-report";
import { computeVerdict, passwordIssuesFromSummary, summarizeIssueCounts } from "./report/verdict";
import type { AuditCliOptions, AuditIssue, AuditReport, StorageObjectRecord } from "./types";

export type RunAuditParams = {
  options: AuditCliOptions;
  prisma?: PrismaClient | null;
  env?: EnvLike;
  projectRoot?: string;
};

export async function runAudit(params: RunAuditParams): Promise<AuditReport> {
  const env = params.env ?? process.env;
  const projectRoot = params.projectRoot ?? resolveProjectRoot();
  const generatedAt = new Date().toISOString();
  const issues: AuditIssue[] = [];
  const buckets = resolveAllBuckets(env);

  const counts = await (async () => {
    if (params.options.skipDatabase || !params.prisma) {
      return {
        counts: [],
        fundamentalReadable: false,
        reachable: false,
        error: params.options.skipDatabase
          ? "Database audit skipped by flag."
          : "DATABASE_URL missing or Prisma client not provided.",
      };
    }
    return auditDatabaseCounts(params.prisma);
  })();

  if (!counts.fundamentalReadable) {
    issues.push({
      code: "DATABASE_FUNDAMENTAL_UNREADABLE",
      severity: "BLOCKING",
      message: counts.error ?? "Fundamental database models are not readable.",
    });
  }

  let password = summarizePasswordHashes([]);
  let relationIssues: AuditIssue[] = [];
  let enrollmentDocuments: Array<{ id: string; filePath: string | null }> = [];
  let medicalVisits: Array<{ id: string; certificateFilePath: string | null }> = [];
  let receipts: Array<{ id: string; filePath: string | null; receiptNumber: string }> = [];

  if (params.prisma && counts.fundamentalReadable) {
    const users = await params.prisma.user.findMany({
      select: { id: true, passwordHash: true },
    });
    password = summarizePasswordHashes(users);
    issues.push(...passwordIssuesFromSummary(password));

    relationIssues = await auditRelations(params.prisma);
    issues.push(...relationIssues);

    enrollmentDocuments = await params.prisma.enrollmentDocument.findMany({
      select: { id: true, filePath: true },
    });
    medicalVisits = await params.prisma.medicalVisit.findMany({
      select: { id: true, certificateFilePath: true },
    });
    receipts = await params.prisma.receipt.findMany({
      select: { id: true, filePath: true, receiptNumber: true },
    });
  }

  const local = await inventoryLocalFallbacks(projectRoot);
  if (local.missingDirs.length) {
    issues.push({
      code: "LOCAL_FALLBACK_DIRS_MISSING",
      severity: "INFO",
      message: "One or more local fallback directories are absent.",
      details: { missing: local.missingDirs.join(", ") },
    });
  }
  if (local.objects.length) {
    issues.push({
      code: "LOCAL_FALLBACK_FILES_PRESENT",
      severity: "WARNING",
      message: "Legacy local fallback files present; include in migration planning.",
      details: { count: local.objects.length },
    });
  }

  let supabaseObjects: StorageObjectRecord[] = [];
  let listErrors: string[] = [];
  let storageConfigured = false;
  let storageReachable = false;
  let skippedReason: string | undefined;
  let storageInventoryFailed = false;

  if (params.options.skipStorage) {
    skippedReason = "Storage audit skipped by --skip-storage";
  } else {
    const storage = createReadOnlyStorageClient(env);
    storageConfigured = storage.configured;
    skippedReason = storage.skippedReason;
    if (storage.client) {
      try {
        const inventory = await inventorySupabaseStorage(storage.client, buckets);
        supabaseObjects = inventory.objects;
        listErrors = inventory.errors;
        storageReachable = listErrors.length === 0 || inventory.objects.length > 0;
        if (listErrors.length && inventory.objects.length === 0) {
          storageInventoryFailed = true;
          issues.push({
            code: "STORAGE_INVENTORY_FAILED",
            severity: "BLOCKING",
            message: "Supabase Storage inventory failed with no objects retrieved.",
            details: { errors: listErrors.slice(0, 5).join(" | ") },
          });
        } else if (listErrors.length) {
          issues.push({
            code: "STORAGE_LIST_PARTIAL_ERRORS",
            severity: "WARNING",
            message: "Partial Storage list errors encountered.",
            details: { errorCount: listErrors.length },
          });
        }
      } catch (error) {
        storageInventoryFailed = true;
        const message = error instanceof Error ? error.message : String(error);
        issues.push({
          code: "STORAGE_INVENTORY_FAILED",
          severity: "BLOCKING",
          message: `Supabase Storage inventory threw: ${message}`,
        });
      }
    } else {
      issues.push({
        code: "STORAGE_NOT_CONFIGURED",
        severity: "WARNING",
        message: "Supabase Storage not configured; file presence checks limited to local fallbacks.",
      });
    }
  }

  const storageAnalysis = analyzeStorageInventory(supabaseObjects);

  const enrollmentBucket = buckets.find((b) => b.domain === "enrollmentDocuments")?.bucket ?? null;
  const medicalBucket = buckets.find((b) => b.domain === "medicalCertificates")?.bucket ?? null;
  const receiptsBucket = buckets.find((b) => b.domain === "receipts")?.bucket ?? null;

  const referenceResult = matchFileReferences({
    db: { enrollmentDocuments, medicalVisits, receipts },
    buckets: {
      enrollmentDocuments: enrollmentBucket,
      medicalCertificates: medicalBucket,
      receipts: receiptsBucket,
      storageConfigured: storageConfigured && !params.options.skipStorage,
    },
    supabaseObjects,
    localObjects: local.objects,
  });
  issues.push(...referenceResult.issues);

  // Count reconciliation sanity: counts array length should match expected when DB ok
  if (counts.fundamentalReadable && counts.counts.some((c) => c.status === "ERROR")) {
    issues.push({
      code: "DATABASE_SECONDARY_COUNT_ERROR",
      severity: "WARNING",
      message: "One or more secondary models failed count().",
    });
  }

  const { verdict, exitCode } = computeVerdict({
    fundamentalReadable: counts.fundamentalReadable,
    storageInventoryFailed,
    issues,
    password,
  });

  const allStorageObjects = [...supabaseObjects, ...local.objects];

  const report: AuditReport = {
    generatedAt,
    verdict,
    exitCode,
    environment: {
      database: {
        reachable: counts.reachable,
        fundamentalReadable: counts.fundamentalReadable,
        error: counts.error,
      },
      storage: {
        configured: storageConfigured,
        reachable: storageReachable,
        skippedReason,
        buckets,
        listErrors,
      },
    },
    counts: counts.counts,
    password,
    issues,
    references: {
      total: referenceResult.stats.total,
      withPath: referenceResult.stats.withPath,
      withoutPath: referenceResult.stats.withoutPath,
      byStatus: referenceResult.stats.byStatus,
      items: referenceResult.references,
    },
    storage: {
      objects: allStorageObjects,
      unreferencedCount: referenceResult.unreferencedStorage.length,
      duplicatePaths: storageAnalysis.duplicatePaths,
      zeroByteCount: storageAnalysis.zeroByteCount,
      unexpectedExtensionCount: storageAnalysis.unexpectedExtensionCount,
    },
    localFallbacks: {
      scannedDirs: local.scannedDirs,
      objects: local.objects,
      missingDirs: local.missingDirs,
    },
    summary: summarizeIssueCounts(issues),
  };

  await ensureOutDir(params.options.outDir);
  await writeDatabaseCounts(params.options.outDir, report.counts);
  await writeStorageInventory(params.options.outDir, allStorageObjects, {
    buckets,
    configured: storageConfigured,
    reachable: storageReachable,
    skippedReason,
    listErrors,
  });
  await writeJsonReport(params.options.outDir, report);
  await writeMarkdownReport(params.options.outDir, report);

  return report;
}
