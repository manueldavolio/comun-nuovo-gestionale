import type { SupabaseClient } from "@supabase/supabase-js";
import type { BucketResolution, StorageDomain, StorageObjectRecord } from "../types";
import { normalizeStoragePath } from "../mask";

const LIST_PAGE_SIZE = 100;

export type ListFolderResult = {
  objects: StorageObjectRecord[];
  errors: string[];
};

function inferDomain(bucket: string, objectPath: string, buckets: BucketResolution[]): StorageDomain {
  const enrollment = buckets.find((b) => b.domain === "enrollmentDocuments")?.bucket;
  const medical = buckets.find((b) => b.domain === "medicalCertificates")?.bucket;
  const receipts = buckets.find((b) => b.domain === "receipts")?.bucket;
  const site = buckets.find((b) => b.domain === "siteImages")?.bucket;
  const path = normalizeStoragePath(objectPath);

  if (enrollment && bucket === enrollment) return "ENROLLMENT_DOCUMENT";
  if (site && bucket === site) return "SITE_MEDIA";
  if (receipts && bucket === receipts && path.startsWith("receipts/")) return "RECEIPT";
  if (medical && bucket === medical && path.startsWith("medical-visits/")) return "MEDICAL_CERTIFICATE";
  if (medical && bucket === medical && path.startsWith("receipts/")) return "RECEIPT";
  if (receipts && bucket === receipts) return "RECEIPT";
  if (medical && bucket === medical) return "MEDICAL_CERTIFICATE";
  return "UNKNOWN";
}

function isLikelyFolderPlaceholder(name: string, id: string | null | undefined): boolean {
  return name === ".emptyFolderPlaceholder" || id == null;
}

/**
 * Recursively list all objects in a bucket using prefix pagination.
 * Supabase list returns at most `limit` items per call; folders are expanded.
 */
export async function listBucketRecursive(
  client: SupabaseClient,
  bucket: string,
  buckets: BucketResolution[],
  prefix = "",
): Promise<ListFolderResult> {
  const objects: StorageObjectRecord[] = [];
  const errors: string[] = [];
  const queue: string[] = [prefix];

  while (queue.length > 0) {
    const currentPrefix = queue.shift() ?? "";
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await client.storage.from(bucket).list(currentPrefix, {
        limit: LIST_PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

      if (error) {
        errors.push(`list ${bucket}/${currentPrefix || "(root)"} @${offset}: ${error.message}`);
        hasMore = false;
        break;
      }

      const entries = data ?? [];
      if (entries.length === 0) {
        hasMore = false;
        break;
      }

      for (const entry of entries) {
        const name = entry.name;
        if (!name || isLikelyFolderPlaceholder(name, entry.id)) {
          // Folder marker or empty name: if no id and no metadata, treat as folder
          if (!entry.id && name && name !== ".emptyFolderPlaceholder") {
            const nextPrefix = currentPrefix ? `${currentPrefix}/${name}` : name;
            queue.push(nextPrefix);
          }
          continue;
        }

        // In Supabase Storage, folders typically have id === null and no metadata.size
        const isFolder = entry.id == null && entry.metadata == null;
        if (isFolder) {
          const nextPrefix = currentPrefix ? `${currentPrefix}/${name}` : name;
          queue.push(nextPrefix);
          continue;
        }

        const objectPath = currentPrefix ? `${currentPrefix}/${name}` : name;
        const meta = (entry.metadata ?? {}) as Record<string, unknown>;
        const sizeRaw = meta.size ?? meta.contentLength;
        const sizeBytes =
          typeof sizeRaw === "number"
            ? sizeRaw
            : typeof sizeRaw === "string"
              ? Number.parseInt(sizeRaw, 10)
              : null;
        const mimeType =
          typeof meta.mimetype === "string"
            ? meta.mimetype
            : typeof meta.contentType === "string"
              ? meta.contentType
              : null;
        const etag = typeof meta.eTag === "string" ? meta.eTag : typeof meta.etag === "string" ? meta.etag : null;

        objects.push({
          bucket,
          path: normalizeStoragePath(objectPath),
          name,
          sizeBytes: Number.isFinite(sizeBytes as number) ? (sizeBytes as number) : null,
          mimeType,
          createdAt: entry.created_at ?? null,
          updatedAt: entry.updated_at ?? entry.last_accessed_at ?? null,
          etag,
          source: "SUPABASE",
          domain: inferDomain(bucket, objectPath, buckets),
        });
      }

      if (entries.length < LIST_PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += LIST_PAGE_SIZE;
      }
    }
  }

  return { objects, errors };
}

export async function inventorySupabaseStorage(
  client: SupabaseClient,
  buckets: BucketResolution[],
): Promise<{ objects: StorageObjectRecord[]; errors: string[]; uniqueBuckets: string[] }> {
  const uniqueBuckets = [...new Set(buckets.map((b) => b.bucket).filter(Boolean) as string[])];
  const objects: StorageObjectRecord[] = [];
  const errors: string[] = [];

  for (const bucket of uniqueBuckets) {
    const result = await listBucketRecursive(client, bucket, buckets);
    objects.push(...result.objects);
    errors.push(...result.errors);
  }

  return { objects, errors, uniqueBuckets };
}

export function analyzeStorageInventory(objects: StorageObjectRecord[]): {
  duplicatePaths: string[];
  zeroByteCount: number;
  unexpectedExtensionCount: number;
} {
  const pathCount = new Map<string, number>();
  for (const obj of objects) {
    const key = `${obj.bucket}::${obj.path}`;
    pathCount.set(key, (pathCount.get(key) ?? 0) + 1);
  }
  const duplicatePaths = [...pathCount.entries()]
    .filter(([, n]) => n > 1)
    .map(([key]) => key);

  const expectedExt = new Set([
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".svg",
    ".gif",
    ".mp4",
    ".mov",
  ]);
  let zeroByteCount = 0;
  let unexpectedExtensionCount = 0;
  for (const obj of objects) {
    if (obj.sizeBytes === 0) zeroByteCount += 1;
    const lower = obj.name.toLowerCase();
    const dot = lower.lastIndexOf(".");
    const ext = dot >= 0 ? lower.slice(dot) : "";
    if (ext && !expectedExt.has(ext)) unexpectedExtensionCount += 1;
  }

  return { duplicatePaths, zeroByteCount, unexpectedExtensionCount };
}

/** Pure helper for tests: simulate paginated list folding. */
export function paginateNames(names: string[], pageSize: number): string[][] {
  const pages: string[][] = [];
  for (let i = 0; i < names.length; i += pageSize) {
    pages.push(names.slice(i, i + pageSize));
  }
  return pages;
}
