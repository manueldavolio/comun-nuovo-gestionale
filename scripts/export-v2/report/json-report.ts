import { promises as fs } from "node:fs";
import path from "node:path";
import type { AuditReport, ModelCount, StorageObjectRecord } from "../types";
import { assertNoSecretsInText } from "../mask";

export async function ensureOutDir(outDir: string): Promise<void> {
  await fs.mkdir(outDir, { recursive: true });
}

export async function writeJsonReport(outDir: string, report: AuditReport): Promise<string> {
  const filePath = path.join(outDir, "audit-report.json");
  const payload = JSON.stringify(report, null, 2);
  const leaks = assertNoSecretsInText(payload);
  if (leaks.length) {
    throw new Error(`Refusing to write audit-report.json: possible secrets detected (${leaks.join(", ")})`);
  }
  await fs.writeFile(filePath, payload, "utf8");
  return filePath;
}

export async function writeDatabaseCounts(outDir: string, counts: ModelCount[]): Promise<string> {
  const filePath = path.join(outDir, "database-counts.json");
  await fs.writeFile(filePath, JSON.stringify({ generatedAt: new Date().toISOString(), counts }, null, 2), "utf8");
  return filePath;
}

export async function writeStorageInventory(
  outDir: string,
  objects: StorageObjectRecord[],
  meta: Record<string, unknown>,
): Promise<string> {
  const filePath = path.join(outDir, "storage-inventory.json");
  const payload = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      meta,
      objects: objects.map((o) => ({
        bucket: o.bucket,
        path: o.path,
        name: o.name,
        sizeBytes: o.sizeBytes,
        mimeType: o.mimeType,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        etag: o.etag,
        source: o.source,
        domain: o.domain,
      })),
    },
    null,
    2,
  );
  await fs.writeFile(filePath, payload, "utf8");
  return filePath;
}
