import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ATHLETE_WITHDRAW_CONFIRM_TOKEN,
  activeAthleteWhere,
  decideReactivateAthlete,
  decideWithdrawAthlete,
  isAthleteActive,
  normalizeWithdrawReason,
  parseAdminAthleteStatusFilter,
  rosterAthletesForConvocationWhere,
  rosterAthletesForEventWhere,
  rosterStatusWhereForAdminFilter,
} from "./athlete-roster-status";

describe("athlete roster status helpers", () => {
  it("treats ACTIVE as active and WITHDRAWN as not", () => {
    assert.equal(isAthleteActive("ACTIVE"), true);
    assert.equal(isAthleteActive("WITHDRAWN"), false);
    assert.equal(isAthleteActive(null), true);
  });

  it("parses admin status filters", () => {
    assert.equal(parseAdminAthleteStatusFilter(undefined), "active");
    assert.equal(parseAdminAthleteStatusFilter("withdrawn"), "withdrawn");
    assert.equal(parseAdminAthleteStatusFilter("all"), "all");
    assert.deepEqual(rosterStatusWhereForAdminFilter("active"), {
      rosterStatus: "ACTIVE",
    });
    assert.deepEqual(rosterStatusWhereForAdminFilter("all"), {});
  });

  it("activeAthleteWhere is ACTIVE only", () => {
    assert.deepEqual(activeAthleteWhere(), { rosterStatus: "ACTIVE" });
  });
});

describe("withdraw / reactivate decisions", () => {
  const now = new Date("2026-10-11T10:00:00.000Z");

  it("withdraws paying athlete without touching payments (decision only)", () => {
    const result = decideWithdrawAthlete({
      rosterStatus: "ACTIVE",
      confirmToken: ATHLETE_WITHDRAW_CONFIRM_TOKEN,
      reason: "Trasferimento",
      withdrawnAt: now,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.rosterStatus, "WITHDRAWN");
    assert.equal(result.data.withdrawReason, "Trasferimento");
    assert.equal(result.data.withdrawnAt.toISOString(), now.toISOString());
  });

  it("withdraws unpaid athlete the same way", () => {
    const result = decideWithdrawAthlete({
      rosterStatus: "ACTIVE",
      confirmToken: ATHLETE_WITHDRAW_CONFIRM_TOKEN,
      reason: null,
      withdrawnAt: now,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.withdrawReason, null);
  });

  it("rejects wrong confirm token", () => {
    const result = decideWithdrawAthlete({
      rosterStatus: "ACTIVE",
      confirmToken: "ELIMINA",
      reason: null,
      withdrawnAt: now,
    });
    assert.equal(result.ok, false);
  });

  it("rejects already withdrawn", () => {
    const result = decideWithdrawAthlete({
      rosterStatus: "WITHDRAWN",
      confirmToken: ATHLETE_WITHDRAW_CONFIRM_TOKEN,
      reason: null,
      withdrawnAt: now,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.status, 409);
  });

  it("reactivates withdrawn athlete", () => {
    const result = decideReactivateAthlete("WITHDRAWN");
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.rosterStatus, "ACTIVE");
    assert.equal(result.data.withdrawnAt, null);
    assert.equal(result.data.withdrawReason, null);
  });

  it("rejects reactivate when already active", () => {
    const result = decideReactivateAthlete("ACTIVE");
    assert.equal(result.ok, false);
  });

  it("normalizes withdraw reason", () => {
    assert.equal(normalizeWithdrawReason("  ok  ").ok, true);
    assert.equal(normalizeWithdrawReason("x".repeat(301)).ok, false);
  });
});

describe("roster filters for mister flows", () => {
  it("event roster includes ACTIVE or historical attendance", () => {
    assert.deepEqual(rosterAthletesForEventWhere("evt-1"), {
      OR: [
        { rosterStatus: "ACTIVE" },
        { attendances: { some: { eventId: "evt-1" } } },
      ],
    });
  });

  it("convocation roster includes ACTIVE or already selected", () => {
    assert.deepEqual(rosterAthletesForConvocationWhere(["a1"]), {
      OR: [{ rosterStatus: "ACTIVE" }, { id: { in: ["a1"] } }],
    });
    assert.deepEqual(rosterAthletesForConvocationWhere([]), {
      OR: [{ rosterStatus: "ACTIVE" }],
    });
  });
});

describe("financial history conservation (contract)", () => {
  it("withdraw decision never includes payment mutations", () => {
    const result = decideWithdrawAthlete({
      rosterStatus: "ACTIVE",
      confirmToken: ATHLETE_WITHDRAW_CONFIRM_TOKEN,
      reason: "Pagato e ritirato",
      withdrawnAt: new Date(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const keys = Object.keys(result.data).sort();
    assert.deepEqual(keys, ["rosterStatus", "withdrawReason", "withdrawnAt"]);
  });
});
