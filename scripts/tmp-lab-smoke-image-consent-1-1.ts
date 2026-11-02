/**
 * LAB/LOCAL smoke: mode, legacy grant, dual DEFERRED/DENIED/revocation, group gate, no 1.0 conversion.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  allowsExternalPublication,
  computeMediaReviewStatus,
  recordAthleteImageConsentChoice,
  recordAthleteImageConsentEvent,
  resolveAthleteImageConsentForPurpose,
} from "../src/lib/image-consent";
import { isDualImageConsentV11Active } from "../src/lib/legal/image-consent-activation";

const PROD_REF = "engtrfqshssdfcmuuhxi";

function assertLabUrl(url: string) {
  const host = new URL(url).hostname;
  if (host.includes(PROD_REF)) throw new Error("REFUSED: production database");
}

function pass(name: string, detail?: string) {
  console.log(`PASS ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name: string, detail: string): never {
  console.error(`FAIL ${name} — ${detail}`);
  process.exit(1);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL required");
  assertLabUrl(databaseUrl);

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: /localhost|127\.0\.0\.1/i.test(new URL(databaseUrl).hostname)
      ? undefined
      : { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const dualActive = await isDualImageConsentV11Active();
    pass("runtime_mode", dualActive ? "dual_v1_1" : "legacy_v1");

    const privacy = await prisma.legalDocument.findFirst({
      where: { kind: "PRIVACY_NOTICE", isCurrent: true },
      select: { version: true },
    });
    if (privacy?.version !== "1.0") fail("privacy_version", String(privacy?.version));
    pass("privacy_remains_1_0");

    const admin = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    const athlete = await prisma.athlete.findFirst({
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    if (!admin || !athlete) fail("fixtures", "need ADMIN user and at least one athlete");

    const beforeEvents = await prisma.athleteImageConsentEvent.count({
      where: { athleteId: athlete.id, purpose: null },
    });

    if (!dualActive) {
      await recordAthleteImageConsentEvent({
        athleteId: athlete.id,
        granted: true,
        actedByUserId: admin.id,
        source: "lab_smoke_legacy",
      });
      const external = await resolveAthleteImageConsentForPurpose(athlete.id, "EXTERNAL");
      if (!allowsExternalPublication(external)) {
        fail("legacy_grant_enables_publication", JSON.stringify(external));
      }
      pass("legacy_grant_enables_publication");

      await recordAthleteImageConsentEvent({
        athleteId: athlete.id,
        granted: false,
        actedByUserId: admin.id,
        source: "lab_smoke_legacy_revoke",
      });
      const revoked = await resolveAthleteImageConsentForPurpose(athlete.id, "EXTERNAL");
      if (allowsExternalPublication(revoked)) fail("legacy_revoke_blocks", JSON.stringify(revoked));
      pass("legacy_revoke_blocks_publication");
    } else {
      // Dual path: DEFERRED/DENIED must not publish; revoke blocks media.
      await recordAthleteImageConsentChoice({
        athleteId: athlete.id,
        purpose: "EXTERNAL",
        choice: "GRANTED",
        actedByUserId: admin.id,
        source: "lab_smoke_dual",
      });
      let external = await resolveAthleteImageConsentForPurpose(athlete.id, "EXTERNAL");
      if (!allowsExternalPublication(external)) fail("dual_grant", JSON.stringify(external));
      pass("dual_external_grant");

      await recordAthleteImageConsentChoice({
        athleteId: athlete.id,
        purpose: "EXTERNAL",
        choice: "DEFERRED",
        actedByUserId: admin.id,
        source: "lab_smoke_dual",
      });
      external = await resolveAthleteImageConsentForPurpose(athlete.id, "EXTERNAL");
      if (allowsExternalPublication(external)) fail("dual_deferred_blocks", JSON.stringify(external));
      pass("dual_deferred_not_consent");

      await recordAthleteImageConsentChoice({
        athleteId: athlete.id,
        purpose: "EXTERNAL",
        choice: "DENIED",
        actedByUserId: admin.id,
        source: "lab_smoke_dual",
      });
      external = await resolveAthleteImageConsentForPurpose(athlete.id, "EXTERNAL");
      if (allowsExternalPublication(external)) fail("dual_denied_blocks", JSON.stringify(external));
      pass("dual_denied_not_consent");

      // Historical 1.0 rows must remain purpose=null (not converted).
      const converted = await prisma.athleteImageConsentEvent.count({
        where: {
          athleteId: athlete.id,
          purpose: null,
          source: { startsWith: "lab_smoke" },
          choice: { not: null },
        },
      });
      if (converted > 0) fail("no_conversion", "legacy rows mutated unexpectedly");
      pass("no_auto_convert_historical_shape");
    }

    // Server-side group gate (pure policy, same as admin subjects route).
    const groupStatus = computeMediaReviewStatus({
      subjectAthleteIds: ["x1", "x2"],
      subjectsDeclaredComplete: true,
      consentByAthleteId: new Map([
        [
          "x1",
          {
            athleteId: "x1",
            granted: true,
            choice: "GRANTED",
            purpose: "EXTERNAL",
            source: "event",
            recordedAt: new Date(),
            documentVersion: "1.1",
            legacyHistoricalOnly: false,
          },
        ],
        [
          "x2",
          {
            athleteId: "x2",
            granted: false,
            choice: "DEFERRED",
            purpose: "EXTERNAL",
            source: "event",
            recordedAt: new Date(),
            documentVersion: "1.1",
            legacyHistoricalOnly: false,
          },
        ],
      ]),
    });
    if (groupStatus !== "BLOCKED_CONSENT") fail("group_gate", groupStatus);
    pass("group_photo_server_policy_blocks_partial_consent");

    const afterLegacy = await prisma.athleteImageConsentEvent.count({
      where: { athleteId: athlete.id, purpose: null },
    });
    if (afterLegacy < beforeEvents) fail("history_preserved", "legacy event count decreased");
    pass("historical_events_retained", `legacyEvents=${afterLegacy}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
