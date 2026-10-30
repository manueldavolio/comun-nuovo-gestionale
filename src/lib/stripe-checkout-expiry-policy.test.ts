import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendCheckoutExpiredAuditNote,
  decideCheckoutSessionExpiredAction,
  isEnrollmentPaymentCheckoutRetryable,
  payableStatusAfterCheckoutExpired,
} from "./stripe-checkout-expiry-policy";
import { buildParentPaymentDisplay } from "./enrollment-fees";

describe("payableStatusAfterCheckoutExpired", () => {
  it("returns OVERDUE when dueDate is in the past", () => {
    assert.equal(
      payableStatusAfterCheckoutExpired(new Date("2026-09-30T00:00:00Z"), new Date("2026-10-30T00:00:00Z")),
      "OVERDUE",
    );
  });

  it("returns PENDING when dueDate is in the future", () => {
    assert.equal(
      payableStatusAfterCheckoutExpired(new Date("2026-12-01T00:00:00Z"), new Date("2026-10-30T00:00:00Z")),
      "PENDING",
    );
  });
});

describe("decideCheckoutSessionExpiredAction", () => {
  const due = new Date("2026-09-30T00:00:00Z");
  const now = new Date("2026-10-30T00:00:00Z");
  const sessionId = "cs_test_expired_1";

  it("never changes PAID (late/out-of-order webhook)", () => {
    const d = decideCheckoutSessionExpiredAction({
      paymentExists: true,
      paymentStatus: "PAID",
      paymentStripeCheckoutSessionId: sessionId,
      expiredSessionId: sessionId,
      dueDate: due,
      now,
    });
    assert.deepEqual(d, { action: "noop", reason: "PAID" });
  });

  it("noops when a newer checkout session is already attached (concurrency)", () => {
    const d = decideCheckoutSessionExpiredAction({
      paymentExists: true,
      paymentStatus: "PENDING",
      paymentStripeCheckoutSessionId: "cs_test_newer",
      expiredSessionId: sessionId,
      dueDate: due,
      now,
    });
    assert.deepEqual(d, { action: "noop", reason: "SESSION_MISMATCH" });
  });

  it("releases matching expired session to OVERDUE without CANCELLED", () => {
    const d = decideCheckoutSessionExpiredAction({
      paymentExists: true,
      paymentStatus: "PENDING",
      paymentStripeCheckoutSessionId: sessionId,
      expiredSessionId: sessionId,
      dueDate: due,
      now,
    });
    assert.equal(d.action, "release_expired_session");
    if (d.action === "release_expired_session") {
      assert.equal(d.nextStatus, "OVERDUE");
      assert.equal(d.clearCheckoutSessionId, true);
    }
  });

  it("releases CANCELLED matching session back to payable OVERDUE", () => {
    const d = decideCheckoutSessionExpiredAction({
      paymentExists: true,
      paymentStatus: "CANCELLED",
      paymentStripeCheckoutSessionId: sessionId,
      expiredSessionId: sessionId,
      dueDate: due,
      now,
    });
    assert.equal(d.action, "release_expired_session");
    if (d.action === "release_expired_session") {
      assert.equal(d.nextStatus, "OVERDUE");
    }
  });

  it("noops when payment missing", () => {
    const d = decideCheckoutSessionExpiredAction({
      paymentExists: false,
      paymentStatus: null,
      paymentStripeCheckoutSessionId: null,
      expiredSessionId: sessionId,
      dueDate: due,
      now,
    });
    assert.deepEqual(d, { action: "noop", reason: "NOT_FOUND" });
  });
});

describe("isEnrollmentPaymentCheckoutRetryable", () => {
  it("allows PENDING/OVERDUE; blocks PAID and DEPOSIT CANCELLED", () => {
    assert.equal(
      isEnrollmentPaymentCheckoutRetryable({
        type: "BALANCE",
        status: "PENDING",
        hasStripePaymentIntent: false,
      }),
      true,
    );
    assert.equal(
      isEnrollmentPaymentCheckoutRetryable({
        type: "DEPOSIT",
        status: "OVERDUE",
        hasStripePaymentIntent: false,
      }),
      true,
    );
    assert.equal(
      isEnrollmentPaymentCheckoutRetryable({
        type: "BALANCE",
        status: "PAID",
        hasStripePaymentIntent: true,
      }),
      false,
    );
    assert.equal(
      isEnrollmentPaymentCheckoutRetryable({
        type: "DEPOSIT",
        status: "CANCELLED",
        hasStripePaymentIntent: false,
      }),
      false,
    );
  });

  it("allows BALANCE CANCELLED only with abandoned session and no PI", () => {
    assert.equal(
      isEnrollmentPaymentCheckoutRetryable({
        type: "BALANCE",
        status: "CANCELLED",
        hasStripePaymentIntent: false,
        hasStripeCheckoutSessionId: true,
      }),
      true,
    );
    assert.equal(
      isEnrollmentPaymentCheckoutRetryable({
        type: "BALANCE",
        status: "CANCELLED",
        hasStripePaymentIntent: false,
        hasStripeCheckoutSessionId: false,
      }),
      false,
    );
    assert.equal(
      isEnrollmentPaymentCheckoutRetryable({
        type: "BALANCE",
        status: "CANCELLED",
        hasStripePaymentIntent: true,
        hasStripeCheckoutSessionId: true,
      }),
      false,
    );
  });
});

describe("appendCheckoutExpiredAuditNote", () => {
  it("appends without wiping history", () => {
    const note = appendCheckoutExpiredAuditNote("Saldo iscrizione.", {
      expiredSessionId: "cs_test_abcdefghijklmnop",
      nextStatus: "OVERDUE",
      at: new Date("2026-10-30T10:00:00.000Z"),
    });
    assert.match(note, /Saldo iscrizione/);
    assert.match(note, /kept payable as OVERDUE/);
  });
});

describe("parent display after expired balance cancel", () => {
  const fees = { deposit: "50.00", balance: "200.00", annual: "250.00" };

  it("deposit PAID + balance CANCELLED with session → can checkout residual saldo", () => {
    const rows = buildParentPaymentDisplay({
      fees,
      payments: [
        { id: "d1", type: "DEPOSIT", status: "PAID", amount: "50.00", receiptId: "r1" },
        {
          id: "b1",
          type: "BALANCE",
          status: "CANCELLED",
          amount: "200.00",
          stripeCheckoutSessionId: "cs_abandoned",
        },
      ],
    });
    const balance = rows.find((r) => r.paymentType === "BALANCE");
    assert.ok(balance);
    assert.equal(balance.canCheckout, true);
    assert.equal(balance.displayAmount, "200.00");
    assert.equal(balance.label, "Saldo");
  });

  it("both CANCELLED with session → only balance as quota completa (no deposit retry)", () => {
    const rows = buildParentPaymentDisplay({
      fees,
      payments: [
        { id: "d1", type: "DEPOSIT", status: "CANCELLED", amount: "50.00" },
        {
          id: "b1",
          type: "BALANCE",
          status: "CANCELLED",
          amount: "200.00",
          stripeCheckoutSessionId: "cs_abandoned",
        },
      ],
    });
    const deposit = rows.find((r) => r.paymentType === "DEPOSIT");
    const balance = rows.find((r) => r.paymentType === "BALANCE");
    assert.equal(deposit?.canCheckout, false);
    assert.equal(balance?.canCheckout, true);
    assert.equal(balance?.displayAmount, "250.00");
    assert.equal(balance?.label, "Quota completa");
  });

  it("admin CANCELLED balance without session stays non-checkoutable", () => {
    const rows = buildParentPaymentDisplay({
      fees,
      payments: [
        { id: "d1", type: "DEPOSIT", status: "PAID", amount: "50.00" },
        { id: "b1", type: "BALANCE", status: "CANCELLED", amount: "200.00" },
      ],
    });
    assert.equal(rows.find((r) => r.paymentType === "BALANCE")?.canCheckout, false);
  });

  it("BALANCE CANCELLED with PI stays non-checkoutable", () => {
    const rows = buildParentPaymentDisplay({
      fees,
      payments: [
        { id: "d1", type: "DEPOSIT", status: "PAID", amount: "50.00" },
        {
          id: "b1",
          type: "BALANCE",
          status: "CANCELLED",
          amount: "200.00",
          stripePaymentIntentId: "pi_test",
          stripeCheckoutSessionId: "cs_x",
        },
      ],
    });
    assert.equal(rows.find((r) => r.paymentType === "BALANCE")?.canCheckout, false);
  });
});
