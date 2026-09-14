import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { changePasswordSchema } from "./validation/account";
import { buildPasswordHashUpdateData } from "./admin-password-reset";

describe("change password validation", () => {
  it("accepts a valid payload", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "oldpass1",
      newPassword: "newpass1",
      confirmPassword: "newpass1",
    });
    assert.equal(parsed.success, true);
  });

  it("rejects mismatched confirmation", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "oldpass1",
      newPassword: "newpass1",
      confirmPassword: "different",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects new password equal to current", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "samepass",
      newPassword: "samepass",
      confirmPassword: "samepass",
    });
    assert.equal(parsed.success, false);
  });

  it("keeps password update payload limited to passwordHash", () => {
    const data = buildPasswordHashUpdateData("$2a$12$example");
    assert.deepEqual(Object.keys(data), ["passwordHash"]);
  });
});
