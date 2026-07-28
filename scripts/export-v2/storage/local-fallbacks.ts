import { promises as fs } from "node:fs";
import path from "node:path";
import { LOCAL_FALLBACK_DIRS } from "../config";
import type { StorageDomain, StorageObjectRecord } from "../types";

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

function inferLocalDomain(relativePath: string): StorageDomain {
  const normalized = relativePath.replaceAll("\\", "/");
  if (normalized.includes("receipts/")) return "RECEIPT";
  if (normalized.includes("medical-visits/")) return "MEDICAL_CERTIFICATE";
  return "UNKNOWN";
}

async function walkFiles(absDir: string, relativeRoot: string): Promise<StorageObjectRecord[]> {
  const results: StorageObjectRecord[] = [];
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  for (const entry of entries) {
    const abs = path.join(absDir, entry.name);
    const rel = path.join(relativeRoot, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) {
      results.push(...(await walkFiles(abs, rel)));
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = await fs.stat(abs);
    results.push({
      bucket: "local",
      path: rel,
      name: entry.name,
      sizeBytes: stat.size,
      mimeType: null,
      createdAt: stat.birthtime?.toISOString?.() ?? null,
      updatedAt: stat.mtime.toISOString(),
      etag: null,
      source: "LOCAL",
      domain: inferLocalDomain(rel),
    });
  }
  return results;
}

export async function inventoryLocalFallbacks(projectRoot: string): Promise<{
  scannedDirs: string[];
  missingDirs: string[];
  objects: StorageObjectRecord[];
}> {
  const scannedDirs: string[] = [];
  const missingDirs: string[] = [];
  const objects: StorageObjectRecord[] = [];

  for (const rel of LOCAL_FALLBACK_DIRS) {
    const abs = path.join(projectRoot, rel);
    if (!(await pathExists(abs))) {
      missingDirs.push(rel);
      continue;
    }
    scannedDirs.push(rel);
    objects.push(...(await walkFiles(abs, rel)));
  }

  return { scannedDirs, missingDirs, objects };
}
