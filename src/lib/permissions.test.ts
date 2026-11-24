import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { UserRole } from "@prisma/client";
import { ROLE_HOME_PATH, canAccessPath, canUseSocialStudio } from "@/lib/permissions";
import { applyJwtRoleFromDb, expectedHomeForRole } from "@/lib/auth-jwt-role";
import {
  ROLE_SYNC_PATH,
  assertSafeRoleHome,
  decideAreaRoleGate,
  decideRoleSyncFromSession,
} from "@/lib/auth-role-sync";
import { decideMiddlewareAuth, wouldRedirectLoop } from "@/lib/middleware-auth";

const ROLES: UserRole[] = [
  "ADMIN",
  "PARENT",
  "COACH",
  "YOUTH_DIRECTOR",
  "SOCIAL_MEDIA_MANAGER",
];

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
    assert.equal(canAccessPath("ADMIN", "/social/calendario"), true);
    assert.equal(canAccessPath("ADMIN", "/social/studio"), true);
    assert.equal(canAccessPath("YOUTH_DIRECTOR", "/admin"), true);
    assert.equal(canAccessPath("YOUTH_DIRECTOR", "/mister"), false);
    assert.equal(canAccessPath("YOUTH_DIRECTOR", "/genitore"), false);
    assert.equal(canAccessPath("YOUTH_DIRECTOR", "/social"), false);
  });

  it("SOCIAL_MEDIA_MANAGER lands on social calendar only", () => {
    assert.equal(ROLE_HOME_PATH.SOCIAL_MEDIA_MANAGER, "/social/calendario");
    assert.equal(expectedHomeForRole("SOCIAL_MEDIA_MANAGER"), "/social/calendario");
    assert.equal(canAccessPath("SOCIAL_MEDIA_MANAGER", "/social/calendario"), true);
    assert.equal(canAccessPath("SOCIAL_MEDIA_MANAGER", "/social/studio"), true);
    assert.equal(canAccessPath("SOCIAL_MEDIA_MANAGER", "/admin"), false);
    assert.equal(canAccessPath("SOCIAL_MEDIA_MANAGER", "/mister"), false);
    assert.equal(canAccessPath("SOCIAL_MEDIA_MANAGER", "/genitore"), false);
  });

  it("canUseSocialStudio allows ADMIN and SOCIAL_MEDIA_MANAGER only", () => {
    assert.equal(canUseSocialStudio("ADMIN"), true);
    assert.equal(canUseSocialStudio("SOCIAL_MEDIA_MANAGER"), true);
    assert.equal(canUseSocialStudio("YOUTH_DIRECTOR"), false);
    assert.equal(canUseSocialStudio("COACH"), false);
    assert.equal(canUseSocialStudio("PARENT"), false);
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
    assert.deepEqual(decision, { type: "redirect", to: ROLE_SYNC_PATH });
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
      assert.equal(wouldRedirectLoop(role, "/social/calendario"), false);
    });
  }

  it("COACH on /genitore goes to role sync then /mister is next", () => {
    const first = decideMiddlewareAuth({
      pathname: "/genitore",
      tokenRole: "COACH",
      hasToken: true,
    });
    assert.deepEqual(first, { type: "redirect", to: ROLE_SYNC_PATH });
    const syncPage = decideMiddlewareAuth({
      pathname: ROLE_SYNC_PATH,
      tokenRole: "COACH",
      hasToken: true,
    });
    assert.deepEqual(syncPage, { type: "next" });
    const second = decideMiddlewareAuth({
      pathname: "/mister",
      tokenRole: "COACH",
      hasToken: true,
    });
    assert.deepEqual(second, { type: "next" });
  });

  it("PARENT on /mister goes to role sync (stale cookie / wrong area)", () => {
    const first = decideMiddlewareAuth({
      pathname: "/mister",
      tokenRole: "PARENT",
      hasToken: true,
    });
    assert.deepEqual(first, { type: "redirect", to: ROLE_SYNC_PATH });
    const afterSyncCookie = decideMiddlewareAuth({
      pathname: "/mister",
      tokenRole: "COACH",
      hasToken: true,
    });
    assert.deepEqual(afterSyncCookie, { type: "next" });
  });

  it("SOCIAL_MEDIA_MANAGER on /admin redirects to role sync", () => {
    const decision = decideMiddlewareAuth({
      pathname: "/admin",
      tokenRole: "SOCIAL_MEDIA_MANAGER",
      hasToken: true,
    });
    assert.deepEqual(decision, { type: "redirect", to: ROLE_SYNC_PATH });
  });

  it("logged-in user on /login redirects to role sync (not back to /login)", () => {
    for (const role of ROLES) {
      const decision = decideMiddlewareAuth({
        pathname: "/login",
        tokenRole: role,
        hasToken: true,
      });
      assert.equal(decision.type, "redirect");
      if (decision.type === "redirect") {
        assert.equal(decision.to, ROLE_SYNC_PATH);
        assert.notEqual(decision.to, "/login");
      }
    }
  });

  it("stale PARENT cookie after promotion: /mister → sync → no loop to /unauthorized", () => {
    const denied = decideMiddlewareAuth({
      pathname: "/mister",
      tokenRole: "PARENT",
      hasToken: true,
    });
    assert.deepEqual(denied, { type: "redirect", to: ROLE_SYNC_PATH });
    const syncOk = decideMiddlewareAuth({
      pathname: ROLE_SYNC_PATH,
      tokenRole: "PARENT",
      hasToken: true,
    });
    assert.deepEqual(syncOk, { type: "next" });
    const homeAfter = decideRoleSyncFromSession({
      hasSessionUser: true,
      sessionRole: "COACH",
    });
    assert.deepEqual(homeAfter, { type: "goto", path: "/mister" });
    const final = decideMiddlewareAuth({
      pathname: "/mister",
      tokenRole: "COACH",
      hasToken: true,
    });
    assert.deepEqual(final, { type: "next" });
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

  it("refreshes YOUTH_DIRECTOR → SOCIAL_MEDIA_MANAGER from DB", () => {
    const next = applyJwtRoleFromDb(
      { sub: "u1", email: "a@b.it", role: "YOUTH_DIRECTOR" },
      {
        id: "u1",
        email: "a@b.it",
        role: "SOCIAL_MEDIA_MANAGER",
        isActive: true,
      },
    );
    assert.equal(next.role, "SOCIAL_MEDIA_MANAGER");
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

describe("role sync decisions", () => {
  it("PARENT→COACH session sync goes to /mister", () => {
    assert.deepEqual(
      decideRoleSyncFromSession({ hasSessionUser: true, sessionRole: "COACH" }),
      { type: "goto", path: "/mister" },
    );
  });

  it("COACH→ADMIN session sync goes to /admin", () => {
    assert.deepEqual(
      decideRoleSyncFromSession({ hasSessionUser: true, sessionRole: "ADMIN" }),
      { type: "goto", path: "/admin" },
    );
  });

  it("inverse COACH→PARENT session sync goes to /genitore", () => {
    assert.deepEqual(
      decideRoleSyncFromSession({ hasSessionUser: true, sessionRole: "PARENT" }),
      { type: "goto", path: "/genitore" },
    );
  });

  it("inactive / missing role forces signout", () => {
    assert.deepEqual(
      decideRoleSyncFromSession({ hasSessionUser: true, sessionRole: undefined }),
      { type: "signout", callbackUrl: "/login" },
    );
    assert.deepEqual(
      decideRoleSyncFromSession({ hasSessionUser: false, sessionRole: null }),
      { type: "signout", callbackUrl: "/login" },
    );
  });

  it("area gate: wrong role → sync, right role → allow, none → login", () => {
    assert.equal(
      decideAreaRoleGate({ sessionRole: "COACH", allowedRoles: ["PARENT"] }),
      "sync",
    );
    assert.equal(
      decideAreaRoleGate({ sessionRole: "PARENT", allowedRoles: ["PARENT"] }),
      "allow",
    );
    assert.equal(
      decideAreaRoleGate({ sessionRole: undefined, allowedRoles: ["PARENT"] }),
      "login",
    );
  });

  it("safe role home never points to a forbidden path", () => {
    for (const role of ROLES) {
      const home = ROLE_HOME_PATH[role];
      assert.deepEqual(assertSafeRoleHome(role, home), { type: "goto", path: home });
    }
    assert.deepEqual(assertSafeRoleHome("PARENT", "/mister"), {
      type: "signout",
      callbackUrl: "/login",
    });
  });

  it("no escalation: PARENT sync cannot land on /admin", () => {
    const decision = decideRoleSyncFromSession({
      hasSessionUser: true,
      sessionRole: "PARENT",
    });
    assert.equal(decision.type, "goto");
    if (decision.type === "goto") {
      assert.equal(decision.path, "/genitore");
      assert.equal(canAccessPath("PARENT", decision.path), true);
      assert.equal(canAccessPath("PARENT", "/admin"), false);
      assert.equal(canAccessPath("PARENT", "/mister"), false);
    }
  });
});
