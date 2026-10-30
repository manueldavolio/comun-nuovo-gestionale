/**
 * Pure policy for Stripe checkout.session.expired handling.
 * Never reverts PAID. Only releases a session that still matches the expired id.
 */

export type CheckoutExpiryDecision =
  | { action: "noop"; reason: "PAID" | "SESSION_MISMATCH" | "NOT_FOUND" }
  | {
      action: "release_expired_session";
      nextStatus: "PENDING" | "OVERDUE";
      clearCheckoutSessionId: true;
    };

/** After an abandoned checkout, debt stays payable (not CANCELLED). */
export function payableStatusAfterCheckoutExpired(
  dueDate: Date,
  now: Date = new Date(),
): "PENDING" | "OVERDUE" {
  return dueDate.getTime() < now.getTime() ? "OVERDUE" : "PENDING";
}

/**
 * Decide how to handle checkout.session.expired for a Payment row.
 * - PAID: never change
 * - stripeCheckoutSessionId must equal the expired session (concurrency / new checkout)
 * - otherwise leave row untouched
 */
export function decideCheckoutSessionExpiredAction(input: {
  paymentExists: boolean;
  paymentStatus: string | null | undefined;
  paymentStripeCheckoutSessionId: string | null | undefined;
  expiredSessionId: string;
  dueDate: Date;
  now?: Date;
}): CheckoutExpiryDecision {
  if (!input.paymentExists) {
    return { action: "noop", reason: "NOT_FOUND" };
  }

  if (input.paymentStatus === "PAID") {
    return { action: "noop", reason: "PAID" };
  }

  if (input.paymentStripeCheckoutSessionId !== input.expiredSessionId) {
    return { action: "noop", reason: "SESSION_MISMATCH" };
  }

  return {
    action: "release_expired_session",
    nextStatus: payableStatusAfterCheckoutExpired(input.dueDate, input.now ?? new Date()),
    clearCheckoutSessionId: true,
  };
}

export function appendCheckoutExpiredAuditNote(
  existingNotes: string | null | undefined,
  input: { expiredSessionId: string; nextStatus: "PENDING" | "OVERDUE"; at?: Date },
): string {
  const stamp = (input.at ?? new Date()).toISOString().slice(0, 19);
  const shortId =
    input.expiredSessionId.length > 24
      ? `${input.expiredSessionId.slice(0, 24)}…`
      : input.expiredSessionId;
  const line = `[${stamp}] Checkout session expired (${shortId}): kept payable as ${input.nextStatus}.`;
  const base = (existingNotes ?? "").trim();
  return base ? `${base}\n${line}` : line;
}

/**
 * CANCELLED may be retried only for BALANCE rows that still carry an abandoned
 * Stripe Checkout session id and no PaymentIntent (expired-checkout bug pattern).
 * Admin/waiver CANCELLED without a session stay non-payable.
 * CANCELLED deposits stay blocked unless explicitly restored.
 */
export function isEnrollmentPaymentCheckoutRetryable(input: {
  type: "DEPOSIT" | "BALANCE" | string;
  status: string;
  hasStripePaymentIntent: boolean;
  hasStripeCheckoutSessionId?: boolean;
}): boolean {
  if (input.status === "PAID") return false;
  if (input.hasStripePaymentIntent) return false;
  if (input.status === "PENDING" || input.status === "OVERDUE") return true;
  if (
    input.status === "CANCELLED" &&
    input.type === "BALANCE" &&
    input.hasStripeCheckoutSessionId === true
  ) {
    return true;
  }
  return false;
}
