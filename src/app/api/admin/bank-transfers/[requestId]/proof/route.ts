import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BankTransferProofStorageError,
  downloadBankTransferProof,
} from "@/lib/bank-transfer-storage";

type RouteContext = { params: Promise<{ requestId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { requestId } = await context.params;
  const row = await prisma.bankTransferRequest.findUnique({
    where: { id: requestId },
    select: { proofFilePath: true },
  });

  if (!row?.proofFilePath) {
    return NextResponse.json({ error: "Contabile non disponibile." }, { status: 404 });
  }

  try {
    const file = await downloadBankTransferProof(row.proofFilePath);
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
