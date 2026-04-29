import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readReceiptPdf, ReceiptStorageError } from "@/lib/receipt-storage";

type RouteContext = {
  params: Promise<{ receiptId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "PARENT" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { receiptId } = await context.params;
  console.info("[receipts] download requested receipt id", { receiptId });
  if (!receiptId) {
    return NextResponse.json({ error: "Ricevuta non valida." }, { status: 400 });
  }

  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    select: {
      id: true,
      receiptNumber: true,
      filePath: true,
      payment: {
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
      },
    },
  });

  if (!receipt) {
    return NextResponse.json({ error: "Ricevuta non trovata." }, { status: 404 });
  }

  if (session.user.role === "PARENT" && receipt.payment.enrollment.athlete.parent.userId !== session.user.id) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  if (!receipt.filePath) {
    console.info("[receipts] download missing file reason", {
      receiptId,
      reason: "DB_FILE_PATH_EMPTY",
    });
    return NextResponse.json({ error: "File ricevuta non disponibile." }, { status: 404 });
  }

  console.info("[receipts] download file path", { receiptId, filePath: receipt.filePath });
  try {
    const fileBuffer = await readReceiptPdf(receipt.filePath);
    const body = new Uint8Array(fileBuffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${receipt.receiptNumber}.pdf"`,
      },
    });
  } catch (error) {
    if (error instanceof ReceiptStorageError) {
      console.info("[receipts] download missing file reason", {
        receiptId,
        reason: error.details.reason ?? "RECEIPT_STORAGE_ERROR",
        stage: error.details.stage,
        bucketPath: error.details.bucketPath,
      });
      const status = error.details.reason === "SUPABASE_DOWNLOAD_NOT_FOUND" ? 404 : 500;
      return NextResponse.json({ error: "File ricevuta non disponibile." }, { status });
    }
    console.info("[receipts] download missing file reason", {
      receiptId,
      reason: "UNEXPECTED_ERROR",
    });
    return NextResponse.json({ error: "File ricevuta non disponibile." }, { status: 500 });
  }
}
