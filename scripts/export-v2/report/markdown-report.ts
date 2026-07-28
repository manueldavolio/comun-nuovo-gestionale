import { promises as fs } from "node:fs";
import path from "node:path";
import { maskEnvPresence } from "../config";
import { assertNoSecretsInText } from "../mask";
import type { AuditReport } from "../types";

function section(title: string): string {
  return `\n## ${title}\n`;
}

export function buildMarkdownReport(report: AuditReport): string {
  const envPresence = maskEnvPresence();
  const lines: string[] = [];

  lines.push(`# Comun Nuovo — Audit Export V2`);
  lines.push("");
  lines.push(`**Verdetto:** \`${report.verdict}\``);
  lines.push(`**Exit code previsto:** \`${report.exitCode}\``);
  lines.push(`**Generato:** ${report.generatedAt}`);
  lines.push("");
  lines.push(`> Report in sola lettura. Non contiene hash password, secret o connessioni complete.`);

  lines.push(section("1. Verdetto"));
  lines.push(`- Stato: **${report.verdict}**`);
  lines.push(`- BLOCKING: ${report.summary.blocking}`);
  lines.push(`- WARNING: ${report.summary.warning}`);
  lines.push(`- INFO: ${report.summary.info}`);

  lines.push(section("2. Data/ora audit"));
  lines.push(`- ISO: \`${report.generatedAt}\``);

  lines.push(section("3. Ambiente"));
  lines.push(`- Database raggiungibile: **${report.environment.database.reachable ? "sì" : "no"}**`);
  lines.push(
    `- Modelli fondamentali leggibili: **${report.environment.database.fundamentalReadable ? "sì" : "no"}**`,
  );
  if (report.environment.database.error) {
    lines.push(`- Errore DB: ${report.environment.database.error}`);
  }
  lines.push(
    `- Supabase Storage configurato: **${report.environment.storage.configured ? "sì" : "no"}**`,
  );
  lines.push(
    `- Supabase Storage raggiungibile: **${report.environment.storage.reachable ? "sì" : "no"}**`,
  );
  if (report.environment.storage.skippedReason) {
    lines.push(`- Storage saltato: ${report.environment.storage.skippedReason}`);
  }
  lines.push(`- Presenza variabili (solo booleani):`);
  for (const [key, present] of Object.entries(envPresence)) {
    lines.push(`  - \`${key}\`: ${present ? "presente" : "assente"}`);
  }
  lines.push(`- Bucket risolti:`);
  for (const bucket of report.environment.storage.buckets) {
    lines.push(
      `  - ${bucket.domain}: \`${bucket.bucket ?? "(none)"}\` (source: ${bucket.sourceEnv}, configured=${bucket.configured})`,
    );
  }

  lines.push(section("4. Conteggi database"));
  lines.push(`| Modello | Count | Status |`);
  lines.push(`|---------|------:|--------|`);
  for (const row of report.counts) {
    lines.push(`| ${row.model} | ${row.count ?? "-"} | ${row.status}${row.error ? ` (${row.error})` : ""} |`);
  }

  lines.push(section("5. Relazioni e orfani"));
  const relationCodes = report.issues.filter((i) =>
    /ORPHAN|MISSING_ROLE|FK|DATE_INCOHERENT|EMPTY_SEASON|UNKNOWN_ROLE|NEGATIVE/.test(i.code),
  );
  if (!relationCodes.length) {
    lines.push(`- Nessun problema relazionale segnalato.`);
  } else {
    for (const issue of relationCodes) {
      lines.push(
        `- [${issue.severity}] \`${issue.code}\`: ${issue.message} (ids: ${(issue.recordIds ?? []).length})`,
      );
    }
  }

  lines.push(section("6. Collisioni"));
  const collisions = report.issues.filter((i) => /DUPLICATE|FILEPATH_DUPLICATE|FILE_REFERENCE_DUPLICATE/.test(i.code));
  if (!collisions.length) {
    lines.push(`- Nessuna collisione rilevata.`);
  } else {
    for (const issue of collisions) {
      lines.push(`- [${issue.severity}] \`${issue.code}\`: ${issue.message}`);
    }
  }

  lines.push(section("7. Password"));
  const p = report.password;
  lines.push(`- Totale utenti: ${p.totalUsers}`);
  lines.push(`- Bcrypt importabili: ${p.bcryptImportable}`);
  lines.push(`- Bcrypt malformed: ${p.bcryptMalformed}`);
  lines.push(`- Empty/null: ${p.emptyOrNull} (WARNING — reset necessario; login app richiede hash)`);
  lines.push(`- Scrypt: ${p.scrypt}`);
  lines.push(`- Argon2: ${p.argon2}`);
  lines.push(`- Unknown: ${p.unknown}`);
  lines.push(`- Reset necessario (conteggio): ${p.resetRequired}`);
  lines.push(`- Distribuzione cost factor: ${JSON.stringify(p.costFactorDistribution)}`);
  lines.push(
    `- ID problematici (malformed): ${p.problematicUserIds.bcryptMalformed.join(", ") || "-"}`,
  );
  lines.push(`- ID problematici (unknown): ${p.problematicUserIds.unknown.join(", ") || "-"}`);
  lines.push(`- ID empty/null: ${p.problematicUserIds.emptyOrNull.join(", ") || "-"}`);

  lines.push(section("8. Storage Supabase"));
  lines.push(`- Oggetti inventariati: ${report.storage.objects.filter((o) => o.source === "SUPABASE").length}`);
  lines.push(`- Non referenziati (core): ${report.storage.unreferencedCount}`);
  lines.push(`- Path duplicati: ${report.storage.duplicatePaths.length}`);
  lines.push(`- Zero byte: ${report.storage.zeroByteCount}`);
  lines.push(`- Estensioni inattese: ${report.storage.unexpectedExtensionCount}`);
  if (report.environment.storage.listErrors.length) {
    lines.push(`- Errori list:`);
    for (const err of report.environment.storage.listErrors.slice(0, 20)) {
      lines.push(`  - ${err}`);
    }
  }

  lines.push(section("9. Fallback locali"));
  lines.push(`- Cartelle scansionate: ${report.localFallbacks.scannedDirs.join(", ") || "-"}`);
  lines.push(`- Cartelle assenti (INFO): ${report.localFallbacks.missingDirs.join(", ") || "-"}`);
  lines.push(`- File locali: ${report.localFallbacks.objects.length}`);

  lines.push(section("10. Confronto riferimenti DB ↔ file"));
  lines.push(`- Totale riferimenti: ${report.references.total}`);
  lines.push(`- Con path: ${report.references.withPath}`);
  lines.push(`- Senza path: ${report.references.withoutPath}`);
  for (const [status, count] of Object.entries(report.references.byStatus)) {
    lines.push(`- ${status}: ${count}`);
  }

  lines.push(section("11. Problemi BLOCKING"));
  const blocking = report.issues.filter((i) => i.severity === "BLOCKING");
  if (!blocking.length) lines.push(`- Nessuno.`);
  for (const issue of blocking) {
    lines.push(`- \`${issue.code}\`: ${issue.message}`);
  }

  lines.push(section("12. Warning"));
  const warnings = report.issues.filter((i) => i.severity === "WARNING");
  if (!warnings.length) lines.push(`- Nessuno.`);
  for (const issue of warnings) {
    lines.push(`- \`${issue.code}\`: ${issue.message}`);
  }

  lines.push(section("13. Informazioni"));
  const infos = report.issues.filter((i) => i.severity === "INFO");
  if (!infos.length) lines.push(`- Nessuna.`);
  for (const issue of infos.slice(0, 50)) {
    lines.push(`- \`${issue.code}\`: ${issue.message}`);
  }

  lines.push(section("14. Passi successivi"));
  if (report.verdict === "BLOCKED") {
    lines.push(`1. Risolvere tutti i problemi BLOCKING elencati sopra.`);
    lines.push(`2. Rieseguire \`npm run export:audit\`.`);
    lines.push(`3. Solo dopo un verdetto non-BLOCKED procedere all'export JSON definitivo (fase successiva).`);
  } else if (report.verdict === "READY_FOR_EXPORT_WITH_WARNINGS") {
    lines.push(`1. Rivedere i WARNING (file orfani Storage, password empty, CMS, legacy locali).`);
    lines.push(`2. Decidere se accettarli per il cutover.`);
    lines.push(`3. Procedere alla fase di export JSON definitivo quando approvato.`);
  } else {
    lines.push(`1. Conservare i file in \`audit-output/\` come baseline.`);
    lines.push(`2. Procedere alla fase di export JSON definitivo quando approvato.`);
  }
  lines.push("");
  lines.push(`Questo report **non** è l'export definitivo verso ClubVision.`);

  return `${lines.join("\n")}\n`;
}

export async function writeMarkdownReport(outDir: string, report: AuditReport): Promise<string> {
  const filePath = path.join(outDir, "audit-report.md");
  const content = buildMarkdownReport(report);
  const leaks = assertNoSecretsInText(content);
  if (leaks.length) {
    throw new Error(`Refusing to write audit-report.md: possible secrets detected (${leaks.join(", ")})`);
  }
  await fs.writeFile(filePath, content, "utf8");
  return filePath;
}
