import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EnrollmentFeesConfigError,
  buildParentPaymentDisplay,
  computeEnrollmentResidual,
  resolveCategoryEnrollmentFees,
  resolveCheckoutChargeAmount,
  shouldCancelUnpaidDepositAfterBalancePaid,
  sumPaidEnrollmentAmount,
} from "./enrollment-fees";

describe("enrollment-fees official 2026/27 schedule", () => {
  it("normal category: annual 250, deposit 50, balance 200", () => {
    const fees = resolveCategoryEnrollmentFees({
      depositFee: "50.00",
      balanceFee: "200.00",
      annualFee: "250.00",
    });
    assert.equal(fees.annual, "250.00");
    assert.equal(fees.deposit, "50.00");
    assert.equal(fees.balance, "200.00");
  });

  it("Gioco Sport: annual 240, deposit 50, balance 190", () => {
    const fees = resolveCategoryEnrollmentFees({
      depositFee: 50,
      balanceFee: 190,
      annualFee: 240,
    });
    assert.equal(fees.annual, "240.00");
    assert.equal(fees.deposit, "50.00");
    assert.equal(fees.balance, "190.00");
  });

  it("after deposit paid, residual is balance (200 / 190)", () => {
    assert.equal(
      computeEnrollmentResidual({
        annualFee: "250.00",
        payments: [
          { type: "DEPOSIT", status: "PAID", amount: "50.00" },
          { type: "BALANCE", status: "PENDING", amount: "200.00" },
        ],
      }),
      200,
    );
    assert.equal(
      computeEnrollmentResidual({
        annualFee: "240.00",
        payments: [
          { type: "DEPOSIT", status: "PAID", amount: "50.00" },
          { type: "BALANCE", status: "PENDING", amount: "190.00" },
        ],
      }),
      190,
    );
  });

  it("without deposit paid, residual is full annual (250 / 240)", () => {
    assert.equal(
      resolveCheckoutChargeAmount({
        paymentType: "BALANCE",
        paymentAmount: "200.00",
        paymentStatus: "PENDING",
        annualFee: "250.00",
        enrollmentPayments: [
          { type: "DEPOSIT", status: "PENDING", amount: "50.00" },
          { type: "BALANCE", status: "PENDING", amount: "200.00" },
        ],
      }),
      "250.00",
    );
    assert.equal(
      resolveCheckoutChargeAmount({
        paymentType: "BALANCE",
        paymentAmount: "190.00",
        paymentStatus: "PENDING",
        annualFee: "240.00",
        enrollmentPayments: [
          { type: "DEPOSIT", status: "PENDING", amount: "50.00" },
          { type: "BALANCE", status: "PENDING", amount: "190.00" },
        ],
      }),
      "240.00",
    );
  });

  it("deposit checkout charges deposit amount, not annual", () => {
    assert.equal(
      resolveCheckoutChargeAmount({
        paymentType: "DEPOSIT",
        paymentAmount: "50.00",
        paymentStatus: "PENDING",
        annualFee: "250.00",
        enrollmentPayments: [
          { type: "DEPOSIT", status: "PENDING", amount: "50.00" },
          { type: "BALANCE", status: "PENDING", amount: "200.00" },
        ],
      }),
      "50.00",
    );
  });

  it("fee 0 does not invent 250", () => {
    assert.throws(
      () =>
        resolveCategoryEnrollmentFees({
          depositFee: 0,
          balanceFee: 0,
          annualFee: 0,
        }),
      (error: unknown) => error instanceof EnrollmentFeesConfigError,
    );
  });

  it("PAID amounts count toward residual; CANCELLED do not", () => {
    assert.equal(
      sumPaidEnrollmentAmount([
        { type: "DEPOSIT", status: "PAID", amount: "50.00" },
        { type: "BALANCE", status: "CANCELLED", amount: "200.00" },
      ]),
      50,
    );
    assert.equal(
      computeEnrollmentResidual({
        annualFee: "250.00",
        payments: [
          { type: "DEPOSIT", status: "PAID", amount: "50.00" },
          { type: "BALANCE", status: "CANCELLED", amount: "200.00" },
        ],
      }),
      200,
    );
  });

  it("cancels unpaid deposit after balance paid; never touches PAID deposit", () => {
    assert.equal(
      shouldCancelUnpaidDepositAfterBalancePaid({
        balanceJustPaid: true,
        depositStatus: "PENDING",
      }),
      true,
    );
    assert.equal(
      shouldCancelUnpaidDepositAfterBalancePaid({
        balanceJustPaid: true,
        depositStatus: "OVERDUE",
      }),
      true,
    );
    assert.equal(
      shouldCancelUnpaidDepositAfterBalancePaid({
        balanceJustPaid: true,
        depositStatus: "PAID",
      }),
      false,
    );
    assert.equal(
      shouldCancelUnpaidDepositAfterBalancePaid({
        balanceJustPaid: true,
        depositStatus: "CANCELLED",
      }),
      false,
    );
  });

  it("Stripe charge equals checkout amount string for residual", () => {
    // Mirror amountToCents used by Stripe checkout.
    const charge = resolveCheckoutChargeAmount({
      paymentType: "BALANCE",
      paymentAmount: "200.00",
      paymentStatus: "PENDING",
      annualFee: "250.00",
      enrollmentPayments: [
        { type: "DEPOSIT", status: "PENDING", amount: "50.00" },
        { type: "BALANCE", status: "PENDING", amount: "200.00" },
      ],
    });
    assert.equal(Math.round(Number(charge) * 100), 25000);
  });

  it("parent UI amount matches Stripe charge (saldo vs quota completa)", () => {
    const normalNoDeposit = buildParentPaymentDisplay({
      fees: resolveCategoryEnrollmentFees({
        depositFee: "50.00",
        balanceFee: "200.00",
        annualFee: "250.00",
      }),
      payments: [
        { id: "d1", type: "DEPOSIT", status: "PENDING", amount: "50.00" },
        { id: "b1", type: "BALANCE", status: "PENDING", amount: "200.00" },
      ],
    });
    const balanceCard = normalNoDeposit.find((row) => row.paymentType === "BALANCE");
    assert.equal(balanceCard?.label, "Quota completa");
    assert.equal(balanceCard?.displayAmount, "250.00");
    assert.equal(balanceCard?.canCheckout, true);

    const normalAfterDeposit = buildParentPaymentDisplay({
      fees: resolveCategoryEnrollmentFees({
        depositFee: "50.00",
        balanceFee: "200.00",
        annualFee: "250.00",
      }),
      payments: [
        { id: "d1", type: "DEPOSIT", status: "PAID", amount: "50.00" },
        { id: "b1", type: "BALANCE", status: "PENDING", amount: "200.00" },
      ],
    });
    const saldoCard = normalAfterDeposit.find((row) => row.paymentType === "BALANCE");
    assert.equal(saldoCard?.label, "Saldo");
    assert.equal(saldoCard?.displayAmount, "200.00");

    const giocoFull = buildParentPaymentDisplay({
      fees: resolveCategoryEnrollmentFees({
        depositFee: "50.00",
        balanceFee: "190.00",
        annualFee: "240.00",
      }),
      payments: [
        { id: "d1", type: "DEPOSIT", status: "PENDING", amount: "50.00" },
        { id: "b1", type: "BALANCE", status: "PENDING", amount: "190.00" },
      ],
    });
    assert.equal(
      giocoFull.find((row) => row.paymentType === "BALANCE")?.displayAmount,
      "240.00",
    );
    assert.equal(
      giocoFull.find((row) => row.paymentType === "BALANCE")?.label,
      "Quota completa",
    );

    const giocoSaldo = buildParentPaymentDisplay({
      fees: resolveCategoryEnrollmentFees({
        depositFee: "50.00",
        balanceFee: "190.00",
        annualFee: "240.00",
      }),
      payments: [
        { id: "d1", type: "DEPOSIT", status: "PAID", amount: "50.00" },
        { id: "b1", type: "BALANCE", status: "PENDING", amount: "190.00" },
      ],
    });
    assert.equal(
      giocoSaldo.find((row) => row.paymentType === "BALANCE")?.displayAmount,
      "190.00",
    );
    assert.equal(giocoSaldo.find((row) => row.paymentType === "BALANCE")?.label, "Saldo");

    const cancelledDeposit = buildParentPaymentDisplay({
      fees: resolveCategoryEnrollmentFees({
        depositFee: "50.00",
        balanceFee: "200.00",
        annualFee: "250.00",
      }),
      payments: [
        { id: "d1", type: "DEPOSIT", status: "CANCELLED", amount: "50.00" },
        { id: "b1", type: "BALANCE", status: "PAID", amount: "250.00" },
      ],
    });
    assert.equal(
      cancelledDeposit.find((row) => row.paymentType === "DEPOSIT")?.canCheckout,
      false,
    );
  });
});
