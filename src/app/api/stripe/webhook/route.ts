import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { markEnrollmentPaymentPaidFromStripe } from "@/lib/enrollment-payments";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";

async function findPaymentForCheckoutSession(stripeCheckoutSessionId: string, fallbackPaymentId?: string) {
  const payment = await prisma.payment.findUnique({
    where: { stripeCheckoutSessionId },
    select: {
      id: true,
      status: true,
      receipt: {
        select: {
          id: true,
          filePath: true,
        },
      },
    },
  });

  if (payment) {
    return payment;
  }

  if (!fallbackPaymentId) {
    return null;
  }

  return prisma.payment.findUnique({
    where: { id: fallbackPaymentId },
    select: {
      id: true,
      status: true,
      receipt: {
        select: {
          id: true,
          filePath: true,
        },
      },
    },
  });
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Stripe signature mancante." }, { status: 400 });
  }

  const payload = await request.text();
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();

  let event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Firma webhook non valida." }, { status: 400 });
  }

  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { eventId: event.id },
  });

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentId = session.metadata?.paymentId;
    const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

    if (existing) {
      console.log("[stripe webhook] duplicate event received", { eventId: event.id, sessionId: session.id });
      const payment = await findPaymentForCheckoutSession(session.id, paymentId);

      if (payment) {
        console.log("[stripe webhook] payment found", {
          paymentId: payment.id,
          status: payment.status,
          hasReceipt: Boolean(payment.receipt),
          hasReceiptFilePath: Boolean(payment.receipt?.filePath?.trim()),
        });
      }

      const hasValidReceiptPath = Boolean(payment?.receipt?.filePath?.trim());
      if (payment?.status === "PAID" && hasValidReceiptPath) {
        console.log("[stripe webhook] duplicate fully processed, skipping", {
          eventId: event.id,
          paymentId: payment.id,
        });
        return NextResponse.json({ received: true, duplicated: true }, { status: 200 });
      }

      if (payment?.status === "PAID" && !hasValidReceiptPath) {
        console.log("[stripe webhook] receipt missing, recovering", {
          eventId: event.id,
          paymentId: payment.id,
        });
        const receiptResult = await markEnrollmentPaymentPaidFromStripe({
          paymentId: payment.id,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        });
        if (receiptResult?.receiptFilePath) {
          console.log("[stripe webhook] receipt recovered", {
            eventId: event.id,
            paymentId: payment.id,
            receiptId: receiptResult.receiptId,
            receiptFilePath: receiptResult.receiptFilePath,
          });
          return NextResponse.json({ received: true, recovered: true }, { status: 200 });
        }
      }
    }

    if (paymentId) {
      console.info("[receipts] payment id", { paymentId, source: "stripe.checkout.session.completed" });
      const receiptResult = await markEnrollmentPaymentPaidFromStripe({
        paymentId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
      });
      if (receiptResult?.receiptId) {
        console.log("[stripe webhook] receipt created", { receiptId: receiptResult.receiptId });
      }
      if (receiptResult?.receiptFilePath) {
        console.log("[stripe webhook] receipt file saved", {
          receiptId: receiptResult.receiptId,
          receiptFilePath: receiptResult.receiptFilePath,
        });
      }
      if (receiptResult?.receiptId) {
        console.info("[receipts] receipt id", { receiptId: receiptResult.receiptId });
      }
    }
  } else if (existing) {
    console.log("[stripe webhook] duplicate event already processed:", event.id);
    return new NextResponse(null, { status: 200 });
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const paymentId = session.metadata?.paymentId;
    if (paymentId) {
      await prisma.payment.updateMany({
        where: {
          id: paymentId,
          status: { not: "PAID" },
        },
        data: {
          status: "CANCELLED",
        },
      });
    }
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object;
    const paymentId = session.metadata?.paymentId;
    if (paymentId) {
      await prisma.payment.updateMany({
        where: {
          id: paymentId,
          status: { not: "PAID" },
        },
        data: {
          status: "OVERDUE",
        },
      });
    }
  }

  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return new NextResponse(null, { status: 200 });
    }
    throw error;
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
