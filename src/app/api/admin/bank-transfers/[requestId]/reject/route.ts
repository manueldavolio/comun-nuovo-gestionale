import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { rejectBankTransferRequest } from "@/lib/bank-transfer";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { requestId } = await context.params;
  const body = (await request.json().catch(() => null)) as { reason?: string } | null;
  const result = await rejectBankTransferRequest({
    requestId,
    reviewedById: session.user.id,
    reason: body?.reason ?? "",
  });

  if ("error" in result) {
    const map: Record<string, { status: number; message: string }> = {
      REQUEST_NOT_FOUND: { status: 404, message: "Richiesta non trovata." },
      REQUEST_STATUS_INVALID: { status: 400, message: "Stato richiesta non valido." },
      PAYMENT_ALREADY_PAID: { status: 409, message: "Pagamento già registrato." },
      REASON_REQUIRED: { status: 400, message: "Motivazione obbligatoria." },
    };
    const mapped = map[String(result.error)] ?? {
      status: 500,
      message: "Respingimento non riuscito.",
    };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  return NextResponse.json({ ok: true });
}
