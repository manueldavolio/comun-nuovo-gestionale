import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dispatchConvocationEmails,
  isFormallyValidEmail,
  sanitizeMailError,
  toSafeUserFacingMailError,
} from "./convocation-email";

describe("convocation email helpers", () => {
  it("validates formal email addresses", () => {
    assert.equal(isFormallyValidEmail("mario.rossi@email.it"), true);
    assert.equal(isFormallyValidEmail("invalid"), false);
    assert.equal(isFormallyValidEmail(""), false);
    assert.equal(isFormallyValidEmail("a@b"), false);
  });

  it("sanitizes secrets and stack traces from mail errors", () => {
    const sanitized = sanitizeMailError({
      code: "EAUTH",
      message: "Invalid login password=supersecret token=abc123 at Object.sendMail (/app/mail.ts:10)",
      stack: "Error: boom\n    at sendMail",
    });

    assert.equal(sanitized.errorCode, "EAUTH");
    assert.equal(sanitized.errorMessage, "Autenticazione SMTP non riuscita");
    assert.equal(sanitized.errorMessage.includes("supersecret"), false);
    assert.equal(sanitized.errorMessage.includes("abc123"), false);
    assert.equal(sanitized.errorMessage.includes("at Object"), false);
  });

  it("maps recipient rejection codes to a safe message", () => {
    assert.equal(toSafeUserFacingMailError("EENVELOPE", "Recipient rejected"), "Destinatario rifiutato");
    assert.equal(toSafeUserFacingMailError("INVALID_EMAIL", "whatever"), "Indirizzo email non valido");
  });

  it("sends successfully to all valid recipients", async () => {
    const calls: string[] = [];
    const outcome = await dispatchConvocationEmails({
      recipients: [
        {
          email: "a@example.com",
          athleteFullName: "Atleta A",
          parentFullName: "Genitore A",
        },
        {
          email: "b@example.com",
          athleteFullName: "Atleta B",
          parentFullName: "Genitore B",
        },
      ],
      sendOne: async (recipient) => {
        calls.push(recipient.email);
      },
    });

    assert.deepEqual(calls, ["a@example.com", "b@example.com"]);
    assert.equal(outcome.sentCount, 2);
    assert.equal(outcome.failedCount, 0);
    assert.deepEqual(outcome.failures, []);
  });

  it("collects a single rejected recipient", async () => {
    const outcome = await dispatchConvocationEmails({
      recipients: [
        {
          email: "ok@example.com",
          athleteFullName: "Atleta Ok",
          parentFullName: "Genitore Ok",
        },
        {
          email: "bad@example.com",
          athleteFullName: "Mario Rossi",
          parentFullName: "Luigi Rossi",
        },
      ],
      sendOne: async (recipient) => {
        if (recipient.email === "bad@example.com") {
          throw { code: "EENVELOPE", message: "Recipient rejected: bad@example.com" };
        }
      },
    });

    assert.equal(outcome.sentCount, 1);
    assert.equal(outcome.failedCount, 1);
    assert.equal(outcome.failures.length, 1);
    assert.equal(outcome.failures[0]?.athleteFullName, "Mario Rossi");
    assert.equal(outcome.failures[0]?.parentFullName, "Luigi Rossi");
    assert.equal(outcome.failures[0]?.email, "bad@example.com");
    assert.equal(outcome.failures[0]?.errorMessage, "Destinatario rifiutato");
  });

  it("treats invalid emails as failures without sending", async () => {
    const calls: string[] = [];
    const outcome = await dispatchConvocationEmails({
      recipients: [
        {
          email: "not-an-email",
          athleteFullName: "Atleta Invalid",
          parentFullName: "Genitore Invalid",
        },
        {
          email: "ok@example.com",
          athleteFullName: "Atleta Ok",
          parentFullName: null,
        },
      ],
      sendOne: async (recipient) => {
        calls.push(recipient.email);
      },
    });

    assert.deepEqual(calls, ["ok@example.com"]);
    assert.equal(outcome.totalRecipients, 2);
    assert.equal(outcome.sentCount, 1);
    assert.equal(outcome.failedCount, 1);
    assert.equal(outcome.failures[0]?.errorCode, "INVALID_EMAIL");
    assert.equal(outcome.failures[0]?.errorMessage, "Indirizzo email non valido");
  });

  it("collects multiple failures", async () => {
    const outcome = await dispatchConvocationEmails({
      recipients: [
        {
          email: "one@example.com",
          athleteFullName: "Uno",
          parentFullName: "Gen Uno",
        },
        {
          email: "two@example.com",
          athleteFullName: "Due",
          parentFullName: "Gen Due",
        },
        {
          email: "bad",
          athleteFullName: "Tre",
          parentFullName: "Gen Tre",
        },
      ],
      sendOne: async (recipient) => {
        if (recipient.email !== "one@example.com") {
          throw { code: "550", message: "Mailbox unavailable" };
        }
      },
    });

    assert.equal(outcome.sentCount, 1);
    assert.equal(outcome.failedCount, 2);
    assert.equal(outcome.failures.length, 2);
  });

  it("handles no available emails", async () => {
    const calls: string[] = [];
    const outcome = await dispatchConvocationEmails({
      recipients: [
        { email: "", athleteFullName: "Vuoto", parentFullName: "Gen" },
        { email: "   ", athleteFullName: "Spazi", parentFullName: "Gen" },
      ],
      sendOne: async (recipient) => {
        calls.push(recipient.email);
      },
    });

    assert.deepEqual(calls, []);
    assert.equal(outcome.sentCount, 0);
    assert.equal(outcome.failedCount, 2);
    assert.equal(outcome.totalRecipients, 2);
    assert.ok(outcome.failures.every((failure) => failure.errorCode === "INVALID_EMAIL"));
  });
});
