/**
 * Quote iscrizione basate su Category.depositFee / balanceFee / annualFee.
 * Nessun fallback che inventa importi da 0.
 */

export class EnrollmentFeesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnrollmentFeesConfigError";
  }
}

export type CategoryFeeFields = {
  depositFee: unknown;
  balanceFee: unknown;
  annualFee?: unknown;
};

export type ResolvedEnrollmentFees = {
  /** Acconto (DEPOSIT). */
  deposit: string;
  /** Saldo dopo acconto (BALANCE se acconto già pagato). */
  balance: string;
  /** Totale stagione = deposit + balance (pagamento unico se acconto non pagato). */
  annual: string;
};

export type PaymentResidualInput = {
  type: "DEPOSIT" | "BALANCE" | "OTHER" | string;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED" | string;
  amount: unknown;
};

function parseMoney(value: unknown): number | null {
  if (value == null) return null;
  const raw =
    typeof value === "object" && value !== null && "toString" in value
      ? String((value as { toString: () => string }).toString())
      : String(value);
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return null;
  return amount;
}

function toMoneyString(amount: number): string {
  return amount.toFixed(2);
}

/** Richiede fee > 0 esplicite. Fee 0 / null → errore configurazione. */
export function resolveCategoryEnrollmentFees(
  input: CategoryFeeFields,
): ResolvedEnrollmentFees {
  const deposit = parseMoney(input.depositFee);
  const balance = parseMoney(input.balanceFee);

  if (deposit == null || deposit <= 0) {
    throw new EnrollmentFeesConfigError(
      "Categoria senza acconto configurato (depositFee deve essere > 0).",
    );
  }
  if (balance == null || balance <= 0) {
    throw new EnrollmentFeesConfigError(
      "Categoria senza saldo configurato (balanceFee deve essere > 0).",
    );
  }

  const annualFromParts = deposit + balance;
  const annualConfigured = parseMoney(input.annualFee);

  // annualFee è informativo: se presente e > 0 deve coincidere con deposit+balance.
  if (
    annualConfigured != null &&
    annualConfigured > 0 &&
    Math.abs(annualConfigured - annualFromParts) > 0.009
  ) {
    throw new EnrollmentFeesConfigError(
      `Quote categoria inconsistenti: annualFee (${toMoneyString(annualConfigured)}) ≠ depositFee+balanceFee (${toMoneyString(annualFromParts)}).`,
    );
  }

  return {
    deposit: toMoneyString(deposit),
    balance: toMoneyString(balance),
    annual: toMoneyString(annualFromParts),
  };
}

/** Totale già incassato (solo PAID). CANCELLED/PENDING/OVERDUE non contano. */
export function sumPaidEnrollmentAmount(payments: PaymentResidualInput[]): number {
  let total = 0;
  for (const payment of payments) {
    if (payment.status !== "PAID") continue;
    if (payment.type !== "DEPOSIT" && payment.type !== "BALANCE") continue;
    const amount = parseMoney(payment.amount);
    if (amount == null || amount <= 0) continue;
    total += amount;
  }
  return Number(total.toFixed(2));
}

/**
 * Residuo dovuto rispetto al totale annuale.
 * - senza acconto pagato → annual (250 / 240)
 * - con acconto pagato → annual - paid (200 / 190 tipicamente)
 */
export function computeEnrollmentResidual(input: {
  annualFee: unknown;
  payments: PaymentResidualInput[];
}): number {
  const annual = parseMoney(input.annualFee);
  if (annual == null || annual <= 0) {
    throw new EnrollmentFeesConfigError(
      "Totale annuale non configurato (annualFee deve essere > 0).",
    );
  }
  const paid = sumPaidEnrollmentAmount(input.payments);
  return Math.max(0, Number((annual - paid).toFixed(2)));
}

/**
 * Importo da addebitare al checkout per una specifica riga Payment.
 * - DEPOSIT: importo riga (acconto), mai il totale annuale.
 * - BALANCE: residuo annuale (pagamento unico se acconto non pagato; altrimenti saldo).
 * Non tocca PAID/CANCELLED storici: solo calcolo.
 */
export function resolveCheckoutChargeAmount(input: {
  paymentType: "DEPOSIT" | "BALANCE";
  paymentAmount: unknown;
  paymentStatus: string;
  annualFee: unknown;
  enrollmentPayments: PaymentResidualInput[];
}): string {
  if (input.paymentStatus === "PAID") {
    throw new EnrollmentFeesConfigError("Pagamento già completato.");
  }
  if (input.paymentStatus === "CANCELLED") {
    throw new EnrollmentFeesConfigError("Pagamento annullato: non addebitabile.");
  }

  if (input.paymentType === "DEPOSIT") {
    const amount = parseMoney(input.paymentAmount);
    if (amount == null || amount <= 0) {
      throw new EnrollmentFeesConfigError("Importo acconto non valido.");
    }
    const residual = computeEnrollmentResidual({
      annualFee: input.annualFee,
      payments: input.enrollmentPayments,
    });
    // Non addebitare più del residuo (evita doppi).
    return toMoneyString(Math.min(amount, residual));
  }

  const residual = computeEnrollmentResidual({
    annualFee: input.annualFee,
    payments: input.enrollmentPayments,
  });
  if (residual <= 0) {
    throw new EnrollmentFeesConfigError("Nessun residuo da pagare per questa iscrizione.");
  }
  return toMoneyString(residual);
}

/** Se il saldo (o totale) è PAID e l'acconto è ancora aperto, va annullato per evitare doppio addebito. */
export function shouldCancelUnpaidDepositAfterBalancePaid(input: {
  balanceJustPaid: boolean;
  depositStatus: string | null | undefined;
}): boolean {
  if (!input.balanceJustPaid) return false;
  return (
    input.depositStatus === "PENDING" ||
    input.depositStatus === "OVERDUE"
  );
}

export type ParentPaymentDisplayRow = {
  paymentId: string;
  paymentType: "DEPOSIT" | "BALANCE";
  status: string;
  /** Etichetta card: Acconto / Saldo / Quota completa */
  label: string;
  /** Importo che verrà inviato a Stripe (o già pagato / annullato). */
  displayAmount: string;
  /** true solo se PENDING/OVERDUE e addebitabile. */
  canCheckout: boolean;
  /** CTA checkout. */
  checkoutLabel: string;
  receiptId: string | null;
};

/**
 * Card pagamenti genitore: importo VISIBILE = importo checkout Stripe.
 * - DEPOSIT non PAID → Acconto = depositFee
 * - BALANCE con DEPOSIT PAID → Saldo = residuo (200/190)
 * - BALANCE senza DEPOSIT PAID → Quota completa = residuo annuale (250/240)
 */
export function buildParentPaymentDisplay(input: {
  fees: ResolvedEnrollmentFees;
  payments: Array<{
    id: string;
    type: string;
    status: string;
    amount: unknown;
    receiptId?: string | null;
  }>;
}): ParentPaymentDisplayRow[] {
  const deposit = input.payments.find((row) => row.type === "DEPOSIT") ?? null;
  const balance = input.payments.find((row) => row.type === "BALANCE") ?? null;
  const rows: ParentPaymentDisplayRow[] = [];

  if (deposit) {
    let displayAmount = input.fees.deposit;
    if (deposit.status === "PAID") {
      displayAmount = toMoneyString(parseMoney(deposit.amount) ?? Number(input.fees.deposit));
    } else if (deposit.status === "PENDING" || deposit.status === "OVERDUE") {
      try {
        displayAmount = resolveCheckoutChargeAmount({
          paymentType: "DEPOSIT",
          paymentAmount: deposit.amount,
          paymentStatus: deposit.status,
          annualFee: input.fees.annual,
          enrollmentPayments: input.payments,
        });
      } catch {
        displayAmount = input.fees.deposit;
      }
    } else if (deposit.status === "CANCELLED") {
      displayAmount = toMoneyString(parseMoney(deposit.amount) ?? Number(input.fees.deposit));
    }

    rows.push({
      paymentId: deposit.id,
      paymentType: "DEPOSIT",
      status: deposit.status,
      label: "Acconto",
      displayAmount,
      canCheckout: deposit.status === "PENDING" || deposit.status === "OVERDUE",
      checkoutLabel: deposit.status === "OVERDUE" ? "Riprova acconto" : "Paga acconto",
      receiptId: deposit.receiptId ?? null,
    });
  }

  if (balance) {
    const depositPaid = deposit?.status === "PAID";
    let displayAmount = depositPaid ? input.fees.balance : input.fees.annual;
    let label = depositPaid ? "Saldo" : "Quota completa";

    if (balance.status === "PAID") {
      displayAmount = toMoneyString(parseMoney(balance.amount) ?? Number(displayAmount));
      label = depositPaid ? "Saldo" : "Quota completa";
    } else if (balance.status === "PENDING" || balance.status === "OVERDUE") {
      try {
        displayAmount = resolveCheckoutChargeAmount({
          paymentType: "BALANCE",
          paymentAmount: balance.amount,
          paymentStatus: balance.status,
          annualFee: input.fees.annual,
          enrollmentPayments: input.payments,
        });
        const residual = Number(displayAmount);
        const annual = Number(input.fees.annual);
        const looksLikeFull = Math.abs(residual - annual) < 0.009;
        label = looksLikeFull ? "Quota completa" : "Saldo";
      } catch {
        // keep defaults
      }
    } else if (balance.status === "CANCELLED") {
      displayAmount = toMoneyString(parseMoney(balance.amount) ?? Number(displayAmount));
    }

    rows.push({
      paymentId: balance.id,
      paymentType: "BALANCE",
      status: balance.status,
      label,
      displayAmount,
      canCheckout: balance.status === "PENDING" || balance.status === "OVERDUE",
      checkoutLabel:
        balance.status === "OVERDUE"
          ? label === "Quota completa"
            ? "Riprova quota completa"
            : "Riprova saldo"
          : label === "Quota completa"
            ? "Paga quota completa"
            : "Paga saldo",
      receiptId: balance.receiptId ?? null,
    });
  }

  return rows;
}

export function formatEuroAmount(amount: string | number): string {
  const value = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value);
}
