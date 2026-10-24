import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNoSocialPayloadLeak,
  decideSocialMatchesAccess,
  findSocialPayloadLeaks,
  toSocialMatchDto,
} from "./social-matches";

describe("social-matches access and DTO", () => {
  it("authorizes SOCIAL_MEDIA_MANAGER and ADMIN", () => {
    assert.equal(
      decideSocialMatchesAccess({
        authenticated: true,
        role: "SOCIAL_MEDIA_MANAGER",
      }).ok,
      true,
    );
    assert.equal(
      decideSocialMatchesAccess({ authenticated: true, role: "ADMIN" }).ok,
      true,
    );
    assert.equal(
      decideSocialMatchesAccess({ authenticated: true, role: "COACH" }).ok,
      false,
    );
    assert.equal(
      decideSocialMatchesAccess({ authenticated: true, role: "YOUTH_DIRECTOR" }).ok,
      false,
    );
    assert.equal(
      decideSocialMatchesAccess({ authenticated: false, role: null }).ok,
      false,
    );
  });

  it("maps only match event types and omits scores", () => {
    const dto = toSocialMatchDto({
      id: "e1",
      startAt: new Date("2026-10-20T15:00:00Z"),
      endAt: null,
      title: "vs Virtus",
      type: "LEAGUE_MATCH",
      opponentName: "Virtus",
      isHome: true,
      location: "Campo Comun Nuovo",
      categoryName: "Under 11",
    });
    assert.ok(dto);
    assert.equal(dto!.typeLabel, "Partita");
    assert.equal(dto!.venueSide, "Casa");
    assert.equal(
      toSocialMatchDto({
        id: "t1",
        startAt: new Date(),
        endAt: null,
        title: "Allenamento",
        type: "TRAINING",
        opponentName: null,
        isHome: null,
        location: null,
        categoryName: "U11",
      }),
      null,
    );
  });

  it("rejects sensitive keys in social payloads", () => {
    assert.deepEqual(findSocialPayloadLeaks({ matches: [{ id: "1" }] }), []);
    assert.ok(findSocialPayloadLeaks({ homeScore: 1 }).includes("homeScore"));
    assert.ok(findSocialPayloadLeaks({ athleteId: "a" }).includes("athleteId"));
    assert.throws(() => assertNoSocialPayloadLeak({ notes: "secret" }));
  });
});
