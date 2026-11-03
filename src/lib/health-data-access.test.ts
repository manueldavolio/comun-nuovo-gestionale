import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveOperationalStatus } from "@/lib/athlete-operational-status";
import {
  assertNonAdminCannotWriteInjuredAttendance,
  canStaffAccessAthleteHealthData,
  coachOperationalStatusApiPayload,
  decideCoachDirectHealthApiAccess,
  decideStaffHealthDataAccess,
  denyHealthOperationalWriteForNonAdmin,
  isHealthOperationalStatus,
  sanitizeAttendanceStatusForNonAdminHealth,
  toParticipationView,
} from "@/lib/health-data-access";
import {
  decideAdminOnlyHealthDataAccess,
  decideMedicalCertificateUploadAccess,
} from "@/lib/youth-director-route-gates";

describe("health data staff access", () => {
  it("allows only ADMIN among staff roles", () => {
    assert.equal(canStaffAccessAthleteHealthData("ADMIN"), true);
    assert.equal(canStaffAccessAthleteHealthData("COACH"), false);
    assert.equal(canStaffAccessAthleteHealthData("YOUTH_DIRECTOR"), false);
    assert.equal(canStaffAccessAthleteHealthData("PARENT"), false);
  });

  it("decideStaffHealthDataAccess rejects COACH with 403", () => {
    const r = decideStaffHealthDataAccess({ authenticated: true, role: "COACH" });
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.status, 403);
      assert.match(r.error, /non consentita/i);
    }
  });

  it("decideCoachDirectHealthApiAccess always denies authenticated coach", () => {
    const r = decideCoachDirectHealthApiAccess({ authenticated: true, role: "COACH" });
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
  });
});

describe("medical visit / certificate gates — COACH cannot access", () => {
  it("decideAdminOnlyHealthDataAccess denies COACH and YD", () => {
    for (const role of ["COACH", "YOUTH_DIRECTOR", "PARENT"] as const) {
      const r = decideAdminOnlyHealthDataAccess({ authenticated: true, role });
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.status, 403);
    }
    assert.equal(
      decideAdminOnlyHealthDataAccess({ authenticated: true, role: "ADMIN" }).ok,
      true,
    );
  });

  it("certificate upload gate denies COACH even with valid athlete", () => {
    const coach = decideMedicalCertificateUploadAccess({
      authenticated: true,
      role: "COACH",
      athleteId: "a1",
      athleteExists: true,
      categoryId: "c1",
      categorySector: "YOUTH",
    });
    assert.equal(coach.ok, false);
    if (!coach.ok) {
      assert.equal(coach.status, 403);
      assert.equal(coach.write, false);
    }
  });

  it("certificate upload gate denies YOUTH_DIRECTOR", () => {
    const yd = decideMedicalCertificateUploadAccess({
      authenticated: true,
      role: "YOUTH_DIRECTOR",
      athleteId: "a1",
      athleteExists: true,
      categoryId: "c1",
      categorySector: "YOUTH",
    });
    assert.equal(yd.ok, false);
    if (!yd.ok) assert.equal(yd.status, 403);
  });
});

describe("operational participation view — no health leakage", () => {
  const wallNow = new Date("2026-11-02T12:00:00.000Z");

  it("maps INJURED/ILL to Non può partecipare without exposing status in coach payload", () => {
    for (const status of ["INJURED", "ILL"] as const) {
      assert.equal(isHealthOperationalStatus(status), true);
      const resolved = resolveOperationalStatus({
        record: { status, note: "Distorsione caviglia", validUntil: null },
        wallNow,
      });
      const view = toParticipationView(resolved);
      assert.equal(view.canParticipate, false);
      assert.equal(view.label, "Non può partecipare");

      const payload = coachOperationalStatusApiPayload({
        role: "COACH",
        resolved,
      });
      assert.equal(payload.canParticipate, false);
      assert.equal(payload.note, null);
      assert.equal(payload.status, "ABSENT");
      assert.notEqual(payload.status, "INJURED");
      assert.notEqual(payload.status, "ILL");
      assert.ok(!JSON.stringify(payload).includes("Distorsione"));
    }
  });

  it("denies coach writing INJURED/ILL", () => {
    const denied = denyHealthOperationalWriteForNonAdmin({
      role: "COACH",
      status: "INJURED",
    });
    assert.equal(denied.ok, false);
    const okAbsent = denyHealthOperationalWriteForNonAdmin({
      role: "COACH",
      status: "ABSENT",
    });
    assert.equal(okAbsent.ok, true);
    const adminOk = denyHealthOperationalWriteForNonAdmin({
      role: "ADMIN",
      status: "ILL",
    });
    assert.equal(adminOk.ok, true);
  });
});

describe("attendance INJURED write", () => {
  it("blocks COACH from writing INJURED", () => {
    const r = assertNonAdminCannotWriteInjuredAttendance({
      role: "COACH",
      status: "INJURED",
    });
    assert.equal(r.ok, false);
  });

  it("allows ADMIN to write INJURED", () => {
    assert.equal(
      assertNonAdminCannotWriteInjuredAttendance({
        role: "ADMIN",
        status: "INJURED",
      }).ok,
      true,
    );
  });
});

describe("attendance status sanitization for non-admin SSR", () => {
  it("maps INJURED to ABSENT for COACH and YOUTH_DIRECTOR", () => {
    assert.equal(sanitizeAttendanceStatusForNonAdminHealth("INJURED", "COACH"), "ABSENT");
    assert.equal(
      sanitizeAttendanceStatusForNonAdminHealth("INJURED", "YOUTH_DIRECTOR"),
      "ABSENT",
    );
    assert.equal(sanitizeAttendanceStatusForNonAdminHealth("JUSTIFIED_ABSENCE", "COACH"), "JUSTIFIED_ABSENCE");
    assert.equal(sanitizeAttendanceStatusForNonAdminHealth("INJURED", "ADMIN"), "INJURED");
  });
});
