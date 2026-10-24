import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideSocialStudioAccess } from "@/lib/social-studio/access";

describe("social studio asset permissions", () => {
  it("allows ADMIN and SOCIAL_MEDIA_MANAGER", () => {
    assert.equal(decideSocialStudioAccess({ authenticated: true, role: "ADMIN" }).ok, true);
    assert.equal(
      decideSocialStudioAccess({ authenticated: true, role: "SOCIAL_MEDIA_MANAGER" }).ok,
      true,
    );
  });

  it("denies COACH and unauthenticated", () => {
    assert.equal(decideSocialStudioAccess({ authenticated: true, role: "COACH" }).ok, false);
    assert.equal(decideSocialStudioAccess({ authenticated: false, role: null }).ok, false);
  });
});
