import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  createOrReuseBankTransferRequest,
  formatIbanForDisplay,
} from "@/lib/bank-transfer";
import { assertUserPrimaryParentOfAthlete } from "@/lib/parent-athletes";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ paymentId: string }> };

export async function POST(_request: Request, context: RouteContext) {
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
    select: { enrollment: { select: { athleteId: true } } },
  });
  if (!payment) {
    return NextResponse.json({ error: "Pagamento non trovato." }, { status: 404 });
  }

  const access = await assertUserPrimaryParentOfAthlete({
    userId: session.user.id,
    athleteId: payment.enrollment.athleteId,
  });
  if (!access.ok) {
    return NextResponse.json(
      { error: "Solo il genitore principale può gestire i pagamenti." },
      { status: 403 },
    );
  }

  const result = await createOrReuseBankTransferRequest({
    paymentId,
    createdById: session.user.id,
  });

  if (!result.ok) {
    const map: Record<string, { status: number; message: string }> = {
      BANK_SETTINGS_MISSING: {
        status: 503,
        message: "Coordinate bancarie non ancora configurate dall'amministrazione.",
      },
      PAYMENT_NOT_FOUND: { status: 404, message: "Pagamento non trovato." },
      PAYMENT_TYPE_NOT_SUPPORTED: { status: 400, message: "Tipo pagamento non supportato." },
      PAYMENT_ALREADY_PAID: { status: 409, message: "Pagamento già registrato." },
      PAYMENT_STATUS_NOT_RETRYABLE: {
        status: 400,
        message: "Questo pagamento non è riprovabile (annullamento amministrativo o già chiuso).",
      },
      ENROLLMENT_FEES_CONFIG: {
        status: 400,
        message:
          "message" in result && typeof result.message === "string" && result.message
            ? result.message
            : "Quote non configurate.",
      },
    };
    const mapped = map[result.error] ?? { status: 500, message: "Impossibile avviare bonifico." };
    return NextResponse.json({ error: mapped.message }, { status: mapped.status });
  }

  const { request, settings, reused } = result;
  return NextResponse.json({
    request: {
      id: request.id,
      status: request.status,
      amount: request.amount.toFixed(2),
      causal: request.causal,
      proofUploadedAt: request.proofUploadedAt?.toISOString() ?? null,
      rejectionReason: request.rejectionReason,
    },
    bank: {
      beneficiary: settings.beneficiary,
      iban: settings.iban,
      ibanDisplay: formatIbanForDisplay(settings.iban),
    },
    reused,
  });
}
