/**
 * Server helper: apply checkout.session.expired without cancelling debt.
 */
import { prisma } from "@/lib/prisma";
import {
  appendCheckoutExpiredAuditNote,
  decideCheckoutSessionExpiredAction,
} from "@/lib/stripe-checkout-expiry-policy";

export async function applyCheckoutSessionExpired(input: {
  expiredSessionId: string;
  paymentIdFromMetadata?: string | null;
  now?: Date;
}): Promise<{
  applied: boolean;
  reason?: string;
  paymentId?: string;
  nextStatus?: "PENDING" | "OVERDUE";
}> {
  const now = input.now ?? new Date();

  let payment = await prisma.payment.findUnique({
    where: { stripeCheckoutSessionId: input.expiredSessionId },
    select: {
      id: true,
      status: true,
      dueDate: true,
      stripeCheckoutSessionId: true,
      notes: true,
    },
  });

  if (!payment && input.paymentIdFromMetadata) {
    payment = await prisma.payment.findUnique({
      where: { id: input.paymentIdFromMetadata },
      select: {
        id: true,
        status: true,
        dueDate: true,
        stripeCheckoutSessionId: true,
        notes: true,
      },
    });
  }

  const decision = decideCheckoutSessionExpiredAction({
    paymentExists: Boolean(payment),
    paymentStatus: payment?.status,
    paymentStripeCheckoutSessionId: payment?.stripeCheckoutSessionId,
    expiredSessionId: input.expiredSessionId,
    dueDate: payment?.dueDate ?? now,
    now,
  });

  if (decision.action === "noop") {
    return {
      applied: false,
      reason: decision.reason,
      paymentId: payment?.id,
    };
  }

  const notes = appendCheckoutExpiredAuditNote(payment!.notes, {
    expiredSessionId: input.expiredSessionId,
    nextStatus: decision.nextStatus,
    at: now,
  });

  // Atomic: only if still not PAID and session id still matches expired session.
  const updated = await prisma.payment.updateMany({
    where: {
      id: payment!.id,
      status: { not: "PAID" },
      stripeCheckoutSessionId: input.expiredSessionId,
    },
    data: {
      status: decision.nextStatus,
      stripeCheckoutSessionId: null,
      notes,
    },
  });

  if (updated.count === 0) {
    return {
      applied: false,
      reason: "SESSION_MISMATCH",
      paymentId: payment!.id,
    };
  }

  return {
    applied: true,
    paymentId: payment!.id,
    nextStatus: decision.nextStatus,
  };
}
