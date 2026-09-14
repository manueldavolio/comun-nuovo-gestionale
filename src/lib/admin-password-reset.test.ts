import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compare, hash } from "bcryptjs";
import {
  buildPasswordHashUpdateData,
  generateTemporaryPassword,
} from "./admin-password-reset";

describe("admin password reset helpers", () => {
  it("generates passwords of at least 12 characters", () => {
    const password = generateTemporaryPassword(16);
    assert.equal(password.length, 16);
    assert.match(password, /^[A-Za-z0-9!@#$%]+$/);
  });

  it("rejects lengths below 12", () => {
    assert.throws(() => generateTemporaryPassword(11), /at least 12/);
  });

  it("builds an update payload with only passwordHash", () => {
    const data = buildPasswordHashUpdateData("$2a$12$examplehash");
    assert.deepEqual(Object.keys(data), ["passwordHash"]);
    assert.equal(data.passwordHash, "$2a$12$examplehash");
  });

  it("hashes with bcrypt cost 12 and verifies", async () => {
    const temporaryPassword = generateTemporaryPassword(16);
    const passwordHash = await hash(temporaryPassword, 12);
    assert.match(passwordHash, /^\$2[aby]\$12\$/);
    assert.equal(await compare(temporaryPassword, passwordHash), true);
  });
});
