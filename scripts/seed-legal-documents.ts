/**
 * Seed catalogo LegalDocument v1.0 (idempotente).
 * Eseguire in locale/staging DOPO la migration additive.
 * Non inventa effectiveFrom: resta null fino al go-live ufficiale.
 *
 * Uso: npx tsx scripts/seed-legal-documents.ts
 */
import { prisma } from "../src/lib/prisma";
import { buildLegalDocumentSeedRows } from "../src/lib/legal/legal-documents";

async function main() {
  const rows = buildLegalDocumentSeedRows();
  for (const row of rows) {
    const existing = await prisma.legalDocument.findUnique({
      where: { kind_version: { kind: row.kind, version: row.version } },
      select: { id: true },
    });
    if (existing) {
      console.info("[seed-legal-documents] skip existing", row.kind, row.version);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await tx.legalDocument.updateMany({
        where: { kind: row.kind, isCurrent: true },
        data: { isCurrent: false, retiredAt: new Date() },
      });
      await tx.legalDocument.create({ data: row });
    });
    console.info("[seed-legal-documents] created", row.kind, row.version);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
