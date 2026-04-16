import path from "node:path";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ receiptId: string }>;
};

function getReceiptCandidates(filePath: string): string[] {
  const normalized = filePath.replaceAll("\\", "/");
  const basename = path.basename(normalized);
  const fromPublicRelative = path.join("public", "receipts", basename);
  const fromLegacyStorage = path.join("storage", "receipts", basename);

  return [fromPublicRelative, fromLegacyStorage];
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { receiptId } = await context.params;
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

  if (receipt.payment.enrollment.athlete.parent.userId !== session.user.id) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  if (!receipt.filePath) {
    return NextResponse.json({ error: "File ricevuta non disponibile." }, { status: 404 });
  }

  const candidates = getReceiptCandidates(receipt.filePath);
  for (const absoluteFilePath of candidates) {
    try {
      const fileBuffer = await readFile(absoluteFilePath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${receipt.receiptNumber}.pdf"`,
        },
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ error: "Impossibile leggere il file ricevuta." }, { status: 500 });
}
