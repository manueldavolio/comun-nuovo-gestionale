import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { changePasswordSchema } from "./validation/account";
import { buildPasswordHashUpdateData } from "./admin-password-reset";

describe("change password validation", () => {
  it("accepts a valid strong payload", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "oldpass12",
      newPassword: "newpass1234",
      confirmPassword: "newpass1234",
    });
    assert.equal(parsed.success, true);
  });

  it("rejects short new passwords", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "oldpass12",
      newPassword: "short1",
      confirmPassword: "short1",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects mismatched confirmation", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "oldpass12",
      newPassword: "newpass1234",
      confirmPassword: "different12",
    });
    assert.equal(parsed.success, false);
  });

  it("rejects new password equal to current", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "samepass12",
      newPassword: "samepass12",
      confirmPassword: "samepass12",
    });
    assert.equal(parsed.success, false);
  });

  it("keeps password update payload limited to passwordHash", () => {
    const data = buildPasswordHashUpdateData("$2a$12$example");
    assert.deepEqual(Object.keys(data), ["passwordHash"]);
  });
});
