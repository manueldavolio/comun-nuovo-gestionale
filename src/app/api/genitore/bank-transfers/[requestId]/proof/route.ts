import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { attachBankTransferProof } from "@/lib/bank-transfer";
import {
  BankTransferProofStorageError,
  downloadBankTransferProof,
  uploadBankTransferProof,
} from "@/lib/bank-transfer-storage";
import { assertUserPrimaryParentOfAthlete } from "@/lib/parent-athletes";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ requestId: string }> };

async function assertParentOwnsRequest(userId: string, requestId: string) {
  const row = await prisma.bankTransferRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      createdById: true,
      proofFilePath: true,
      payment: { select: { enrollment: { select: { athleteId: true } } } },
    },
  });
  if (!row) return { ok: false as const, error: "NOT_FOUND" as const };
  if (row.createdById !== userId) return { ok: false as const, error: "FORBIDDEN" as const };
  const access = await assertUserPrimaryParentOfAthlete({
    userId,
    athleteId: row.payment.enrollment.athleteId,
  });
  if (!access.ok) return { ok: false as const, error: "FORBIDDEN" as const };
  return { ok: true as const, row };
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { requestId } = await context.params;
  const ownership = await assertParentOwnsRequest(session.user.id, requestId);
  if (!ownership.ok) {
    const status = ownership.error === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: ownership.error === "NOT_FOUND" ? "Richiesta non trovata." : "Accesso negato." },
      { status },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File contabile mancante." }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBankTransferProof({
      requestId,
      bytes,
      mimeType: file.type || "application/octet-stream",
    });
    const attached = await attachBankTransferProof({
      requestId,
      actorUserId: session.user.id,
      objectPath: uploaded.objectPath,
      mimeType: uploaded.mimeType,
    });
    if ("error" in attached) {
      const map: Record<string, { status: number; message: string }> = {
        REQUEST_NOT_FOUND: { status: 404, message: "Richiesta non trovata." },
        FORBIDDEN: { status: 403, message: "Accesso negato." },
        PAYMENT_ALREADY_PAID: { status: 409, message: "Pagamento già registrato." },
        REQUEST_STATUS_INVALID: {
          status: 400,
          message: "Non è possibile caricare la contabile in questo stato.",
        },
      };
      const mapped = map[String(attached.error)] ?? {
        status: 500,
        message: "Upload non riuscito.",
      };
      return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    }
    return NextResponse.json({
      ok: true,
      status: attached.request.status,
      proofUploadedAt: attached.request.proofUploadedAt?.toISOString() ?? null,
    });
  } catch (error) {
    if (error instanceof BankTransferProofStorageError) {
      const status = error.details.stage === "validate" ? 400 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { requestId } = await context.params;
  const ownership = await assertParentOwnsRequest(session.user.id, requestId);
  if (!ownership.ok) {
    const status = ownership.error === "NOT_FOUND" ? 404 : 403;
    return NextResponse.json(
      { error: ownership.error === "NOT_FOUND" ? "Richiesta non trovata." : "Accesso negato." },
      { status },
    );
  }
  const proofPath = ownership.row.proofFilePath;
  if (!proofPath) {
    return NextResponse.json({ error: "Contabile non disponibile." }, { status: 404 });
  }

  try {
    const file = await downloadBankTransferProof(proofPath);
    return new NextResponse(new Uint8Array(file.bytes), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof BankTransferProofStorageError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    throw error;
  }
}
