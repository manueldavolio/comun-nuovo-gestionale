import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildParentPaymentDisplay,
  resolveCategoryEnrollmentFees,
} from "./enrollment-fees";

/**
 * Simulates the /genitore RSC mapping into buildParentPaymentDisplay.
 * Regression: omitting Stripe session/PI made CANCELLED BALANCE non-payable in UI
 * even when checkout API would accept it.
 */
function mapLikeGenitorePage(payments: Array<{
  id: string;
  type: string;
  status: string;
  amount: string;
  receiptId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
}>) {
  return buildParentPaymentDisplay({
    fees: resolveCategoryEnrollmentFees({
      depositFee: "50.00",
      balanceFee: "200.00",
      annualFee: "250.00",
    }),
    payments: payments.map((payment) => ({
      id: payment.id,
      type: payment.type,
      status: payment.status,
      amount: payment.amount,
      receiptId: payment.receiptId ?? null,
      stripeCheckoutSessionId: payment.stripeCheckoutSessionId,
      stripePaymentIntentId: payment.stripePaymentIntentId,
    })),
  });
}

describe("parent /genitore payment UI wiring", () => {
  it("BUG regression: without session fields CANCELLED balance looks non-payable", () => {
    const rows = mapLikeGenitorePage([
      { id: "d1", type: "DEPOSIT", status: "CANCELLED", amount: "50.00" },
      { id: "b1", type: "BALANCE", status: "CANCELLED", amount: "200.00" },
    ]);
    assert.equal(rows.find((r) => r.paymentType === "BALANCE")?.canCheckout, false);
  });

  it("cohort B: both CANCELLED + abandoned session → Quota completa 250 payable", () => {
    const rows = mapLikeGenitorePage([
      { id: "d1", type: "DEPOSIT", status: "CANCELLED", amount: "50.00" },
      {
        id: "b1",
        type: "BALANCE",
        status: "CANCELLED",
        amount: "200.00",
        stripeCheckoutSessionId: "cs_abandoned_b",
      },
    ]);
    const deposit = rows.find((r) => r.paymentType === "DEPOSIT");
    const balance = rows.find((r) => r.paymentType === "BALANCE");
    assert.equal(deposit?.canCheckout, false);
    assert.equal(balance?.canCheckout, true);
    assert.equal(balance?.label, "Quota completa");
    assert.equal(balance?.displayAmount, "250.00");
  });

  it("cohort A: deposit PAID + cancelled balance with session → Saldo 200 payable", () => {
    const rows = mapLikeGenitorePage([
      { id: "d1", type: "DEPOSIT", status: "PAID", amount: "50.00", receiptId: "r1" },
      {
        id: "b1",
        type: "BALANCE",
        status: "CANCELLED",
        amount: "200.00",
        stripeCheckoutSessionId: "cs_abandoned_a",
      },
    ]);
    const balance = rows.find((r) => r.paymentType === "BALANCE");
    assert.equal(balance?.canCheckout, true);
    assert.equal(balance?.label, "Saldo");
    assert.equal(balance?.displayAmount, "200.00");
  });

  it("admin cancel without session stays blocked", () => {
    const rows = mapLikeGenitorePage([
      { id: "d1", type: "DEPOSIT", status: "PAID", amount: "50.00" },
      { id: "b1", type: "BALANCE", status: "CANCELLED", amount: "200.00" },
    ]);
    assert.equal(rows.find((r) => r.paymentType === "BALANCE")?.canCheckout, false);
  });
});
