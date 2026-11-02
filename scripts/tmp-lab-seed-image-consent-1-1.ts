/**
 * LAB/LOCAL only: upsert legal documents for image consent 1.1 catalog.
 * Keeps IMAGE_MEDIA_CONSENT 1.0 current. Does NOT activate dual 1.1.
 * Refuses production Supabase ref.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { buildLegalDocumentSeedRows } from "../src/lib/legal/legal-document-seed";

const PROD_REF = "engtrfqshssdfcmuuhxi";

function assertLabUrl(url: string) {
  const host = new URL(url).hostname;
  if (host.includes(PROD_REF) || (!/localhost|127\.0\.0\.1/i.test(host) && !/lab/i.test(host))) {
    // Allow localhost always; block known prod ref.
    if (host.includes(PROD_REF)) {
      throw new Error(`REFUSED: looks like production host (${host})`);
    }
  }
  if (host.includes(PROD_REF)) {
    throw new Error("REFUSED: production database");
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  assertLabUrl(databaseUrl);
  console.log("target_host=", new URL(databaseUrl).hostname);

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: /localhost|127\.0\.0\.1/i.test(new URL(databaseUrl).hostname)
      ? undefined
      : { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const rows = buildLegalDocumentSeedRows();
    for (const row of rows) {
      await prisma.legalDocument.upsert({
        where: { kind_version: { kind: row.kind!, version: row.version! } },
        create: row,
        update: {
          title: row.title,
          bodyText: row.bodyText,
          contentSha256: row.contentSha256,
          // Seed must not flip activation flags for dual docs or retire 1.0.
          ...(row.kind === "IMAGE_CONSENT_INTERNAL" || row.kind === "IMAGE_CONSENT_EXTERNAL"
            ? {}
            : row.kind === "IMAGE_MEDIA_CONSENT" ||
                row.kind === "PRIVACY_NOTICE" ||
                row.kind === "SOCIETY_REGULATION"
              ? { isCurrent: true, effectiveFrom: null, retiredAt: null }
              : {}),
        },
      });
    }

    // Explicit safety: keep 1.0 current; dual catalog not current.
    await prisma.legalDocument.updateMany({
      where: { kind: "IMAGE_MEDIA_CONSENT", version: "1.0" },
      data: { isCurrent: true, retiredAt: null },
    });
    await prisma.legalDocument.updateMany({
      where: { kind: { in: ["IMAGE_CONSENT_INTERNAL", "IMAGE_CONSENT_EXTERNAL"] }, version: "1.1" },
      data: { isCurrent: false, effectiveFrom: null, retiredAt: null },
    });

    const current = await prisma.legalDocument.findMany({
      where: { isCurrent: true },
      select: { kind: true, version: true, effectiveFrom: true },
      orderBy: { kind: "asc" },
    });
    console.log("current_docs=", current);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
