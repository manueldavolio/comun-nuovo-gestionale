import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { approveBankTransferRequest } from "@/lib/bank-transfer";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { requestId } = await context.params;
  const result = await approveBankTransferRequest({
    requestId,
    reviewedById: session.user.id,
  });

  if ("error" in result) {
    const map: Record<string, { status: number; message: string }> = {
      REQUEST_NOT_FOUND: { status: 404, message: "Richiesta non trovata." },
      REQUEST_STATUS_INVALID: { status: 400, message: "Stato richiesta non valido per l'approvazione." },
      PAYMENT_ALREADY_PAID: {
        status: 409,
        message: "Pagamento già registrato (es. Stripe). Nessuna doppia contabilizzazione.",
      },
      PAYMENT_TYPE_NOT_SUPPORTED: { status: 400, message: "Tipo pagamento non supportato." },
    };
    const mapped = map[result.error] ?? { status: 500, message: "Approvazione non riuscita." };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  return NextResponse.json({
    ok: true,
    paymentId: result.paymentId,
    receiptId: result.receiptId,
  });
}
