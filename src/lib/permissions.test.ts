import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserRole } from "@prisma/client";
import { ROLE_HOME_PATH, canAccessPath } from "@/lib/permissions";
import { applyJwtRoleFromDb, expectedHomeForRole } from "@/lib/auth-jwt-role";
import { decideMiddlewareAuth, wouldRedirectLoop } from "@/lib/middleware-auth";

const ROLES: UserRole[] = ["ADMIN", "PARENT", "COACH", "YOUTH_DIRECTOR"];

describe("role home paths", () => {
  it("COACH lands on /mister", () => {
    assert.equal(ROLE_HOME_PATH.COACH, "/mister");
    assert.equal(expectedHomeForRole("COACH"), "/mister");
    assert.equal(canAccessPath("COACH", "/mister"), true);
    assert.equal(canAccessPath("COACH", "/mister/squadra"), true);
  });

  it("PARENT lands on /genitore", () => {
    assert.equal(ROLE_HOME_PATH.PARENT, "/genitore");
    assert.equal(canAccessPath("PARENT", "/genitore"), true);
    assert.equal(canAccessPath("PARENT", "/mister"), false);
  });

  it("ADMIN and YOUTH_DIRECTOR keep admin (+ admin may access mister tools)", () => {
    assert.equal(ROLE_HOME_PATH.ADMIN, "/admin");
    assert.equal(ROLE_HOME_PATH.YOUTH_DIRECTOR, "/admin");
    assert.equal(canAccessPath("ADMIN", "/admin"), true);
    assert.equal(canAccessPath("ADMIN", "/mister"), true);
    assert.equal(canAccessPath("YOUTH_DIRECTOR", "/admin"), true);
    assert.equal(canAccessPath("YOUTH_DIRECTOR", "/mister"), false);
    assert.equal(canAccessPath("YOUTH_DIRECTOR", "/genitore"), false);
  });
});

describe("multi-profile (ParentProfile + CoachProfile) uses User.role only", () => {
  it("promoted mister (COACH) cannot stay on /genitore even if ParentProfile still exists", () => {
    assert.equal(canAccessPath("COACH", "/genitore"), false);
    const decision = decideMiddlewareAuth({
      pathname: "/genitore",
      tokenRole: "COACH",
      hasToken: true,
    });
    assert.deepEqual(decision, { type: "redirect", to: "/mister" });
  });

  it("pure parent still reaches /genitore", () => {
    const decision = decideMiddlewareAuth({
      pathname: "/genitore",
      tokenRole: "PARENT",
      hasToken: true,
    });
    assert.deepEqual(decision, { type: "next" });
  });
});

describe("middleware redirects without loops", () => {
  for (const role of ROLES) {
    it(`${role}: home path is always accessible (no loop)`, () => {
      const home = ROLE_HOME_PATH[role];
      assert.equal(canAccessPath(role, home), true);
      assert.equal(wouldRedirectLoop(role, "/genitore"), false);
      assert.equal(wouldRedirectLoop(role, "/mister"), false);
      assert.equal(wouldRedirectLoop(role, "/admin"), false);
    });
  }

  it("COACH on /genitore redirects once to /mister then next", () => {
    const first = decideMiddlewareAuth({
      pathname: "/genitore",
      tokenRole: "COACH",
      hasToken: true,
    });
    assert.deepEqual(first, { type: "redirect", to: "/mister" });
    const second = decideMiddlewareAuth({
      pathname: "/mister",
      tokenRole: "COACH",
      hasToken: true,
    });
    assert.deepEqual(second, { type: "next" });
  });

  it("PARENT on /mister redirects once to /genitore then next", () => {
    const first = decideMiddlewareAuth({
      pathname: "/mister",
      tokenRole: "PARENT",
      hasToken: true,
    });
    assert.deepEqual(first, { type: "redirect", to: "/genitore" });
    const second = decideMiddlewareAuth({
      pathname: "/genitore",
      tokenRole: "PARENT",
      hasToken: true,
    });
    assert.deepEqual(second, { type: "next" });
  });

  it("logged-in user on /login redirects to role home (not back to /login)", () => {
    for (const role of ROLES) {
      const decision = decideMiddlewareAuth({
        pathname: "/login",
        tokenRole: role,
        hasToken: true,
      });
      assert.equal(decision.type, "redirect");
      if (decision.type === "redirect") {
        assert.equal(decision.to, ROLE_HOME_PATH[role]);
        assert.notEqual(decision.to, "/login");
      }
    }
  });

  it("anonymous on protected path goes to login with callback", () => {
    const decision = decideMiddlewareAuth({
      pathname: "/mister/squadra",
      tokenRole: undefined,
      hasToken: false,
    });
    assert.deepEqual(decision, {
      type: "redirect",
      to: "/login?callbackUrl=%2Fmister%2Fsquadra",
    });
  });
});

describe("JWT role refresh", () => {
  it("refreshes PARENT → COACH from DB", () => {
    const next = applyJwtRoleFromDb(
      { sub: "u1", email: "a@b.it", role: "PARENT" },
      { id: "u1", email: "a@b.it", role: "COACH", isActive: true },
    );
    assert.equal(next.role, "COACH");
  });

  it("keeps existing role when DB is unreachable", () => {
    const next = applyJwtRoleFromDb(
      { sub: "u1", email: "a@b.it", role: "COACH" },
      null,
      { dbUnreachable: true },
    );
    assert.equal(next.role, "COACH");
  });

  it("clears role when user inactive", () => {
    const next = applyJwtRoleFromDb(
      { sub: "u1", role: "COACH" },
      { id: "u1", email: "a@b.it", role: "COACH", isActive: false },
    );
    assert.equal(next.role, undefined);
  });
});
