import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { markEnrollmentPaymentPaidFromStripe } from "@/lib/enrollment-payments";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";

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

  if (existing) {
    console.log("[stripe webhook] duplicate event, skipping:", event.id);
    return new NextResponse(null, { status: 200 });
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
      console.log("[stripe webhook] duplicate event, skipping:", event.id);
      return new NextResponse(null, { status: 200 });
    }
    throw error;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentId = session.metadata?.paymentId;
    if (paymentId) {
      console.info("[receipts] payment id", { paymentId, source: "stripe.checkout.session.completed" });
      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : null;
      const receiptResult = await markEnrollmentPaymentPaidFromStripe({
        paymentId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: paymentIntentId,
      });
      if (receiptResult?.receiptId) {
        console.info("[receipts] receipt id", { receiptId: receiptResult.receiptId });
      }
    }
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

  return NextResponse.json({ received: true }, { status: 200 });
}
