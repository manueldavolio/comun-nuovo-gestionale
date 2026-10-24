import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideSocialStudioAccess } from "./access";
import { parseOverrides, assertNoSocialStudioPayloadLeak } from "./dto";
import { defaultHeadline, isSocialGraphicFormat, isSocialGraphicTemplate } from "./templates";

describe("social-studio access", () => {
  it("allows ADMIN and SOCIAL_MEDIA_MANAGER", () => {
    assert.equal(
      decideSocialStudioAccess({ authenticated: true, role: "ADMIN" }).ok,
      true,
    );
    assert.equal(
      decideSocialStudioAccess({
        authenticated: true,
        role: "SOCIAL_MEDIA_MANAGER",
      }).ok,
      true,
    );
    assert.equal(
      decideSocialStudioAccess({ authenticated: true, role: "YOUTH_DIRECTOR" }).ok,
      false,
    );
    assert.equal(
      decideSocialStudioAccess({ authenticated: true, role: "COACH" }).ok,
      false,
    );
    assert.equal(
      decideSocialStudioAccess({ authenticated: false, role: "ADMIN" }).ok,
      false,
    );
  });
});

describe("social-studio dto helpers", () => {
  it("parses overrides safely", () => {
    const overrides = parseOverrides({
      headline: "MATCHDAY",
      homeScore: 2,
      awayScore: null,
      athleteId: "should-be-ignored-as-unknown",
    });
    assert.equal(overrides.headline, "MATCHDAY");
    assert.equal(overrides.homeScore, 2);
    assert.equal(overrides.awayScore, null);
    assert.equal("athleteId" in overrides, false);
  });

  it("rejects sensitive payload keys", () => {
    assert.throws(() => assertNoSocialStudioPayloadLeak({ athleteId: "x" }));
    assert.doesNotThrow(() =>
      assertNoSocialStudioPayloadLeak({
        matches: [{ eventId: "1", homeScore: 1, awayScore: 0 }],
      }),
    );
  });

  it("validates templates and formats", () => {
    assert.equal(isSocialGraphicTemplate("MATCHDAY"), true);
    assert.equal(isSocialGraphicTemplate("FOO"), false);
    assert.equal(isSocialGraphicFormat("SQUARE_1080"), true);
    assert.equal(defaultHeadline("FULL_TIME"), "FULL TIME");
  });
});
