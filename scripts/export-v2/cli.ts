import "dotenv/config";
import { parseCliArgs } from "./config";
import { runAudit } from "./audit";
import { createReadOnlyPrismaClient, disconnectReadOnlyPrisma } from "./read-only-prisma";

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  let prisma = null as ReturnType<typeof createReadOnlyPrismaClient> | null;
  let exitCode: 0 | 1 | 2 = 2;

  console.info("[export:audit] starting read-only audit");
  console.info(`[export:audit] outDir=${options.outDir}`);

  try {
    if (!options.skipDatabase) {
      const databaseUrl = process.env.DATABASE_URL?.trim();
      if (!databaseUrl) {
        console.error("[export:audit] DATABASE_URL is missing. Aborting with technical error.");
        process.exitCode = 2;
        return;
      }
      prisma = createReadOnlyPrismaClient(databaseUrl);
    }

    const report = await runAudit({ options, prisma });
    exitCode = report.exitCode;
    console.info(`[export:audit] verdict=${report.verdict}`);
    console.info(`[export:audit] blocking=${report.summary.blocking} warning=${report.summary.warning} info=${report.summary.info}`);
    console.info(`[export:audit] wrote reports to ${options.outDir}`);
  } catch (error) {
    exitCode = 2;
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[export:audit] unexpected error: ${message}`);
  } finally {
    await disconnectReadOnlyPrisma(prisma);
  }

  process.exitCode = exitCode;
}

void main();
