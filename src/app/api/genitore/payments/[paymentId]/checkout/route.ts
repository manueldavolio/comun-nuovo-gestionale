import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

const CHECKOUT_AMOUNT_BY_TYPE = {
  // TEST TEMPORANEO STRIPE - ricordarsi di ripristinare 5000 e 20000
  DEPOSIT: 50,
  BALANCE: 50,
} as const;

type RouteContext = {
  params: Promise<{ paymentId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { paymentId } = await context.params;
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      type: true,
      status: true,
      enrollment: {
        select: {
          seasonLabel: true,
          athlete: {
            select: {
              firstName: true,
              lastName: true,
              parent: {
                select: {
                  userId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Pagamento non trovato." }, { status: 404 });
  }

  if (payment.enrollment.athlete.parent.userId !== session.user.id) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  if (payment.type !== "DEPOSIT" && payment.type !== "BALANCE") {
    return NextResponse.json({ error: "Tipo pagamento non supportato." }, { status: 400 });
  }

  if (payment.status === "PAID") {
    return NextResponse.json({ error: "Pagamento già registrato." }, { status: 409 });
  }

  const stripe = getStripeClient();
  const athleteName =
    `${payment.enrollment.athlete.firstName} ${payment.enrollment.athlete.lastName}`.trim();
  const amountCents =
    payment.type === "DEPOSIT" ? CHECKOUT_AMOUNT_BY_TYPE.DEPOSIT : CHECKOUT_AMOUNT_BY_TYPE.BALANCE;
  const description =
    payment.type === "DEPOSIT"
      ? `Acconto iscrizione ${athleteName} - stagione ${payment.enrollment.seasonLabel}`
      : `Saldo iscrizione ${athleteName} - stagione ${payment.enrollment.seasonLabel}`;

  const origin = new URL(request.url).origin;
  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${origin}/genitore?stripe=success`,
    cancel_url: `${origin}/genitore?stripe=cancel`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: amountCents,
          product_data: {
            name: description,
          },
        },
      },
    ],
    metadata: {
      paymentId: payment.id,
      parentUserId: session.user.id,
      paymentType: payment.type,
    },
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      stripeCheckoutSessionId: checkoutSession.id,
    },
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url }, { status: 200 });
}
