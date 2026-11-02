/**
 * LAB/LOCAL only: explicit activation of dual image consent 1.1.
 * Sets INTERNAL/EXTERNAL current + effectiveFrom=now, retires IMAGE_MEDIA_CONSENT current flag.
 * Does NOT convert historical 1.0 consent rows.
 * Usage: tsx scripts/tmp-lab-activate-image-consent-1-1.ts [--rollback]
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const PROD_REF = "engtrfqshssdfcmuuhxi";
const rollback = process.argv.includes("--rollback");

function assertLabUrl(url: string) {
  const host = new URL(url).hostname;
  if (host.includes(PROD_REF)) throw new Error("REFUSED: production database");
  if (!/localhost|127\.0\.0\.1|lab/i.test(host)) {
    throw new Error(`REFUSED: unexpected host for lab script (${host})`);
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  assertLabUrl(databaseUrl);
  console.log("target_host=", new URL(databaseUrl).hostname, "mode=", rollback ? "rollback" : "activate");

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: /localhost|127\.0\.0\.1/i.test(new URL(databaseUrl).hostname)
      ? undefined
      : { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const now = new Date();

  try {
    if (rollback) {
      await prisma.$transaction([
        prisma.legalDocument.updateMany({
          where: { kind: "IMAGE_MEDIA_CONSENT", version: "1.0" },
          data: { isCurrent: true, retiredAt: null },
        }),
        prisma.legalDocument.updateMany({
          where: {
            kind: { in: ["IMAGE_CONSENT_INTERNAL", "IMAGE_CONSENT_EXTERNAL"] },
            version: "1.1",
          },
          data: { isCurrent: false, effectiveFrom: null, retiredAt: null },
        }),
      ]);
    } else {
      const dual = await prisma.legalDocument.findMany({
        where: {
          kind: { in: ["IMAGE_CONSENT_INTERNAL", "IMAGE_CONSENT_EXTERNAL"] },
          version: "1.1",
        },
        select: { id: true, kind: true },
      });
      if (dual.length !== 2) {
        throw new Error("INTERNAL/EXTERNAL 1.1 rows missing — run lab seed first");
      }
      await prisma.$transaction([
        prisma.legalDocument.updateMany({
          where: {
            kind: { in: ["IMAGE_CONSENT_INTERNAL", "IMAGE_CONSENT_EXTERNAL"] },
            version: "1.1",
          },
          data: { isCurrent: true, effectiveFrom: now, retiredAt: null },
        }),
        prisma.legalDocument.updateMany({
          where: { kind: "IMAGE_MEDIA_CONSENT", version: "1.0" },
          data: { isCurrent: false, retiredAt: now },
        }),
      ]);
    }

    const rows = await prisma.legalDocument.findMany({
      where: {
        kind: {
          in: ["IMAGE_MEDIA_CONSENT", "IMAGE_CONSENT_INTERNAL", "IMAGE_CONSENT_EXTERNAL", "PRIVACY_NOTICE"],
        },
      },
      select: { kind: true, version: true, isCurrent: true, effectiveFrom: true, retiredAt: true },
      orderBy: [{ kind: "asc" }, { version: "asc" }],
    });
    console.log(rows);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
