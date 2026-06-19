import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { regenerateEnrollmentPaymentCheckout } from "@/lib/enrollment-payments";

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
      enrollment: {
        select: {
          athlete: {
            select: {
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

  const origin = new URL(request.url).origin;
  const result = await regenerateEnrollmentPaymentCheckout({
    paymentId,
    origin,
    successPath: "/genitore?stripe=success",
    cancelPath: "/genitore?stripe=cancel",
  });

  if ("error" in result) {
    if (result.error === "PAYMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Pagamento non trovato." }, { status: 404 });
    }
    if (result.error === "PAYMENT_TYPE_NOT_SUPPORTED") {
      return NextResponse.json({ error: "Tipo pagamento non supportato." }, { status: 400 });
    }
    if (result.error === "PAYMENT_ALREADY_PAID") {
      return NextResponse.json({ error: "Pagamento già registrato." }, { status: 409 });
    }
    if (result.error === "PAYMENT_STATUS_NOT_RETRYABLE") {
      return NextResponse.json({ error: "Stato pagamento non valido per il checkout." }, { status: 400 });
    }
    return NextResponse.json({ error: "Impossibile creare checkout." }, { status: 500 });
  }

  return NextResponse.json({ checkoutUrl: result.checkoutUrl }, { status: 200 });
}
