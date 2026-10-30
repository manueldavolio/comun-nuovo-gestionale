/**
 * Idempotent restore of BALANCE payments wrongly CANCELLED after Stripe checkout expiry.
 * Season 2026/2027 only.
 *
 * Default: DRY-RUN (read-only against EXPORT_AUDIT_DATABASE_URL).
 * Apply: requires --apply AND ALLOW_PROD_PAYMENT_RESTORE=1 (not used in this phase).
 *
 * Does NOT: change PAID rows, amounts, dueDates, send email, restore DEPOSIT automatically.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { payableStatusAfterCheckoutExpired } from "../src/lib/stripe-checkout-expiry-policy";

const SEASON = "2026/2027";
const APPLY = process.argv.includes("--apply");
const ALLOW = process.env.ALLOW_PROD_PAYMENT_RESTORE === "1";

function loadUrl(): string {
  const raw = fs.readFileSync(path.join(process.cwd(), ".env"), "utf8");
  const line = raw
    .split(/\r?\n/)
    .find((row) => row.startsWith("EXPORT_AUDIT_DATABASE_URL="));
  if (!line) throw new Error("EXPORT_AUDIT_DATABASE_URL missing");
  return line.slice("EXPORT_AUDIT_DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

function shortHash(id: string) {
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 10);
}

function initials(first: string, last: string) {
  return `${(first ?? "").trim().slice(0, 1)}. ${(last ?? "").trim().slice(0, 1)}.`;
}

type Candidate = {
  paymentId: string;
  enrollmentId: string;
  athleteInitials: string;
  category: string;
  enrollmentStatus: string;
  amount: string;
  dueDate: Date;
  nextStatus: "PENDING" | "OVERDUE";
  hasSession: boolean;
  hasPi: boolean;
  depositStatus: string | null;
  depositHasPi: boolean;
  cohort: "A_DEPOSIT_PAID" | "B_BOTH_CANCELLED" | "EXCLUDE";
  excludeReason?: string;
  chargeHint: "SALDO_RESIDUO" | "QUOTA_COMPLETA" | "N/A";
  annualFee: string;
};

async function main() {
  if (APPLY && !ALLOW) {
    throw new Error(
      "REFUSE apply: set ALLOW_PROD_PAYMENT_RESTORE=1 only after explicit production approval",
    );
  }

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const client = new pg.Client({
    connectionString: loadUrl(),
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120000,
  });
  await client.connect();

  if (!APPLY) {
    await client.query("BEGIN READ ONLY");
  } else {
    await client.query("BEGIN");
  }

  const now = new Date();

  const rows = await client.query(
    `
    SELECT
      bal.id AS payment_id,
      e.id AS enrollment_id,
      e.status::text AS enrollment_status,
      a."firstName" AS first_name,
      a."lastName" AS last_name,
      c.name AS category_name,
      c."annualFee"::text AS annual_fee,
      bal.amount::text AS amount,
      bal."dueDate" AS due_date,
      bal.status::text AS balance_status,
      bal."stripeCheckoutSessionId" IS NOT NULL AS has_session,
      bal."stripePaymentIntentId" IS NOT NULL AS has_pi,
      bal.notes AS notes,
      dep.status::text AS deposit_status,
      dep."stripePaymentIntentId" IS NOT NULL AS deposit_has_pi,
      (SELECT COUNT(*)::int FROM "Payment" b2
        WHERE b2."enrollmentId" = e.id AND b2.type = 'BALANCE' AND b2.status = 'PAID') AS paid_balance_n,
      (SELECT COUNT(*)::int FROM "Payment" b3
        WHERE b3."enrollmentId" = e.id AND b3.type = 'BALANCE'
          AND b3.status IN ('PENDING','OVERDUE')) AS open_balance_n,
      (SELECT COUNT(*)::int FROM "Payment" b4
        WHERE b4."enrollmentId" = e.id AND b4.type = 'BALANCE') AS balance_row_n
    FROM "Payment" bal
    JOIN "Enrollment" e ON e.id = bal."enrollmentId"
    JOIN "Athlete" a ON a.id = e."athleteId"
    JOIN "Category" c ON c.id = e."categoryId"
    LEFT JOIN "Payment" dep ON dep."enrollmentId" = e.id AND dep.type = 'DEPOSIT'
    WHERE e."seasonLabel" = $1
      AND bal.type = 'BALANCE'
      AND bal.status = 'CANCELLED'
    ORDER BY a."lastName", a."firstName"
    `,
    [SEASON],
  );

  const candidates: Candidate[] = [];
  const excluded: Candidate[] = [];

  for (const row of rows.rows) {
    const nextStatus = payableStatusAfterCheckoutExpired(new Date(row.due_date), now);
    const base: Candidate = {
      paymentId: row.payment_id,
      enrollmentId: row.enrollment_id,
      athleteInitials: initials(row.first_name, row.last_name),
      category: row.category_name,
      enrollmentStatus: row.enrollment_status,
      amount: row.amount,
      dueDate: row.due_date,
      nextStatus,
      hasSession: row.has_session,
      hasPi: row.has_pi,
      depositStatus: row.deposit_status,
      depositHasPi: row.deposit_has_pi,
      cohort: "EXCLUDE",
      chargeHint: "N/A",
      annualFee: row.annual_fee,
    };

    if (row.has_pi) {
      excluded.push({ ...base, excludeReason: "has_stripe_payment_intent" });
      continue;
    }
    if (row.paid_balance_n > 0) {
      excluded.push({ ...base, excludeReason: "enrollment_already_has_PAID_balance" });
      continue;
    }
    if (row.open_balance_n > 0) {
      excluded.push({ ...base, excludeReason: "enrollment_already_has_open_balance" });
      continue;
    }
    if (row.balance_row_n > 1) {
      excluded.push({ ...base, excludeReason: "duplicate_balance_rows" });
      continue;
    }
    if (row.enrollment_status !== "APPROVED" && row.enrollment_status !== "SUBMITTED") {
      excluded.push({ ...base, excludeReason: `enrollment_${row.enrollment_status}` });
      continue;
    }

    if (row.deposit_status === "PAID") {
      candidates.push({
        ...base,
        cohort: "A_DEPOSIT_PAID",
        chargeHint: "SALDO_RESIDUO",
      });
      continue;
    }

    if (row.deposit_status === "CANCELLED" && !row.deposit_has_pi) {
      candidates.push({
        ...base,
        cohort: "B_BOTH_CANCELLED",
        chargeHint: "QUOTA_COMPLETA",
      });
      continue;
    }

    excluded.push({
      ...base,
      excludeReason: `unexpected_deposit_status_${row.deposit_status ?? "null"}`,
    });
  }

  const auditStamp = now.toISOString().slice(0, 19);
  const planned = candidates.map((c) => ({
    paymentHash: shortHash(c.paymentId),
    enrollmentHash: shortHash(c.enrollmentId),
    athleteInitials: c.athleteInitials,
    category: c.category,
    cohort: c.cohort,
    amount: c.amount,
    annualFee: c.annualFee,
    chargeHint: c.chargeHint,
    fromStatus: "CANCELLED",
    toStatus: c.nextStatus,
    clearSession: c.hasSession,
    depositStatusLeftUntouched: c.depositStatus,
    auditNote: `[${auditStamp}] Restored from CANCELLED after expired Stripe checkout (season ${SEASON}, dryRun=${!APPLY}).`,
  }));

  const summary = {
    mode: APPLY ? "APPLY" : "DRY_RUN",
    season: SEASON,
    scannedCancelledBalances: rows.rows.length,
    restoreCount: candidates.length,
    excludeCount: excluded.length,
    cohortA_depositPaid: candidates.filter((c) => c.cohort === "A_DEPOSIT_PAID").length,
    cohortB_bothCancelled: candidates.filter((c) => c.cohort === "B_BOTH_CANCELLED").length,
    sumNominalBalanceAmounts: candidates
      .reduce((acc, c) => acc + Number(c.amount), 0)
      .toFixed(2),
    sumAnnualFeesCohortB: candidates
      .filter((c) => c.cohort === "B_BOTH_CANCELLED")
      .reduce((acc, c) => acc + Number(c.annualFee), 0)
      .toFixed(2),
    exclusionsByReason: excluded.reduce<Record<string, number>>((acc, e) => {
      const k = e.excludeReason ?? "unknown";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
    stripeLiveRetrieve: "skipped_in_dry_run_no_real_stripe_calls",
    depositRestore: "NOT_INCLUDED_needs_separate_approval",
    plannedSample: planned.slice(0, 15),
    excludedSample: excluded.slice(0, 10).map((e) => ({
      paymentHash: shortHash(e.paymentId),
      initials: e.athleteInitials,
      reason: e.excludeReason,
      depositStatus: e.depositStatus,
    })),
  };

  fs.mkdirSync(path.join(process.cwd(), "tmp"), { recursive: true });
  const outPath = path.join(
    process.cwd(),
    "tmp",
    `restore-cancelled-balances-${SEASON.replace("/", "-")}-${APPLY ? "apply" : "dry-run"}.json`,
  );
  fs.writeFileSync(
    outPath,
    JSON.stringify({ summary, planned, excluded: summary.excludedSample }, null, 2),
  );

  if (APPLY) {
    // Safety: re-validate each row inside transaction before update
    let applied = 0;
    for (const c of candidates) {
      const check = await client.query(
        `
        SELECT id, status, "stripePaymentIntentId", "stripeCheckoutSessionId", notes, amount::text, "dueDate"
        FROM "Payment"
        WHERE id = $1
        FOR UPDATE
        `,
        [c.paymentId],
      );
      const row = check.rows[0];
      if (!row || row.status !== "CANCELLED" || row.stripePaymentIntentId) {
        continue;
      }
      const noteLine = `[${auditStamp}] Restored from CANCELLED after expired Stripe checkout (season ${SEASON}).`;
      const notes = row.notes?.trim() ? `${row.notes.trim()}\n${noteLine}` : noteLine;
      await client.query(
        `
        UPDATE "Payment"
        SET status = $2,
            "stripeCheckoutSessionId" = NULL,
            notes = $3,
            "updatedAt" = NOW()
        WHERE id = $1
          AND status = 'CANCELLED'
          AND "stripePaymentIntentId" IS NULL
        `,
        [c.paymentId, c.nextStatus, notes],
      );
      applied += 1;
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({ ...summary, applied, outPath }, null, 2));
  } else {
    await client.query("ROLLBACK");
    console.log(JSON.stringify({ ...summary, outPath }, null, 2));
  }

  await client.end();
}

main().catch((e) => {
  console.error("RESTORE_SCRIPT_FAILED", e instanceof Error ? e.message : e);
  process.exit(1);
});
