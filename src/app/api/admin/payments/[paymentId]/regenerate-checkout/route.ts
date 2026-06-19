import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { regenerateEnrollmentPaymentCheckout } from "@/lib/enrollment-payments";

type RouteContext = {
  params: Promise<{ paymentId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { paymentId } = await context.params;
  if (!paymentId) {
    return NextResponse.json({ error: "Payment non valido." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const result = await regenerateEnrollmentPaymentCheckout({
    paymentId,
    origin,
    successPath: "/admin/finanze?stripe=success",
    cancelPath: "/admin/finanze?stripe=cancel",
  });

  if ("error" in result) {
    if (result.error === "PAYMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Payment non trovato." }, { status: 404 });
    }
    if (result.error === "PAYMENT_TYPE_NOT_SUPPORTED") {
      return NextResponse.json({ error: "Tipo payment non supportato." }, { status: 400 });
    }
    if (result.error === "PAYMENT_ALREADY_PAID") {
      return NextResponse.json({ error: "Pagamento gia pagato." }, { status: 400 });
    }
    if (result.error === "PAYMENT_STATUS_NOT_RETRYABLE") {
      return NextResponse.json({ error: "Stato payment non valido per rigenerazione checkout." }, { status: 400 });
    }
    return NextResponse.json({ error: "Impossibile rigenerare checkout." }, { status: 500 });
  }

  return NextResponse.json({ checkoutUrl: result.checkoutUrl }, { status: 200 });
}
