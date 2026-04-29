import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { regenerateReceiptForPaidPayment } from "@/lib/enrollment-payments";

type RouteContext = {
  params: Promise<{ paymentId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
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

    console.info("[receipt regenerate] paymentId", { paymentId });
    console.log("[receipt regenerate] step: fetch payment", { paymentId });
    console.log("[receipt regenerate] step: check payment status");
    console.log("[receipt regenerate] step: fetch existing receipt");
    console.log("[receipt regenerate] step: pdf generation start");
    console.log("[receipt regenerate] step: file save start");
    console.log("[receipt regenerate] step: update/create receipt");

    const result = await regenerateReceiptForPaidPayment(paymentId);

    console.log("[receipt regenerate] step: fetch payment success", { paymentId });

    if ("error" in result) {
      if (result.error === "PAYMENT_NOT_FOUND") {
        return NextResponse.json({ error: "Payment non trovato." }, { status: 404 });
      }
      if (result.error === "PAYMENT_NOT_PAID") {
        return NextResponse.json({ error: "Il payment non e pagato (status != PAID)." }, { status: 400 });
      }
      if (result.error === "PAYMENT_TYPE_NOT_SUPPORTED") {
        return NextResponse.json({ error: "Tipo payment non supportato per ricevuta." }, { status: 400 });
      }
      return NextResponse.json({ error: "Impossibile rigenerare la ricevuta." }, { status: 500 });
    }

    console.log("[receipt regenerate] step: check payment status success");
    console.log("[receipt regenerate] step: fetch existing receipt success");
    console.log("[receipt regenerate] step: pdf generation success");
    console.log("[receipt regenerate] step: file save success", { filePath: result.filePath });
    console.log("[receipt regenerate] step: update/create receipt success", { receiptId: result.receiptId });
    console.info("[receipt regenerate] receiptId", { receiptId: result.receiptId });
    console.info("[receipt regenerate] filePath saved", { filePath: result.filePath });
    return NextResponse.json(
      {
        ok: true,
        receiptId: result.receiptId,
        filePath: result.filePath,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[receipt regenerate][FATAL]", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });

    return NextResponse.json(
      {
        error: "REGENERATE_FAILED",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
