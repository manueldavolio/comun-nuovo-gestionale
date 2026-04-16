import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { sendReceiptMail } from "@/lib/mail";
import { generateReceiptPdf } from "@/lib/pdf";
import { prisma } from "@/lib/prisma";

const CLUB_DATA = {
  name: "Associazione Sportiva Dilettantistica Comun Nuovo",
  address: "Via Azzurri 2006 snc",
  cityPostalCode: "24040 Comun Nuovo",
  vatOrTaxCode: "04232930166",
} as const;

const SPORT_SEASON = "2026/2027";
const DEFAULT_PAYMENT_METHOD = "Manuale dashboard (test)";
const RECEIPT_SEQUENCE_PAD = 6;

function getReceiptStoragePaths(fileName: string) {
  const relativeDir = "receipts";
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  return {
    relativePath: `${relativeDir}/${fileName}`.replaceAll("\\", "/"),
    absolutePath: path.join(absoluteDir, fileName),
    absoluteDir,
  };
}

async function getNextReceiptNumber(issueDate: Date): Promise<string> {
  const year = issueDate.getFullYear();
  const prefix = `CN-${year}-`;
  const lastReceipt = await prisma.receipt.findFirst({
    where: {
      receiptNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      receiptNumber: "desc",
    },
    select: {
      receiptNumber: true,
    },
  });

  const lastProgressiveRaw = lastReceipt?.receiptNumber.slice(prefix.length) ?? "0";
  const lastProgressive = Number.parseInt(lastProgressiveRaw, 10);
  const nextProgressive = Number.isNaN(lastProgressive) ? 1 : lastProgressive + 1;
  return `${prefix}${String(nextProgressive).padStart(RECEIPT_SEQUENCE_PAD, "0")}`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

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
  if (!paymentId) {
    return NextResponse.json({ error: "Pagamento non valido." }, { status: 400 });
  }

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const paymentMethodInput =
    typeof payload === "object" && payload !== null && "paymentMethod" in payload
      ? payload.paymentMethod
      : undefined;
  const paymentMethod =
    typeof paymentMethodInput === "string" && paymentMethodInput.trim().length > 0
      ? paymentMethodInput.trim()
      : DEFAULT_PAYMENT_METHOD;

  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      status: true,
      amount: true,
      type: true,
      paymentMethod: true,
      paidAt: true,
      enrollment: {
        select: {
          seasonLabel: true,
          receiptFirstName: true,
          receiptLastName: true,
          receiptTaxCode: true,
          receiptEmail: true,
          athlete: {
            select: {
              firstName: true,
              lastName: true,
              parent: {
                select: {
                  userId: true,
                },
              },
            },
          },
          category: {
            select: {
              name: true,
            },
          },
        },
      },
      receipt: {
        select: {
          id: true,
          receiptNumber: true,
          issueDate: true,
          filePath: true,
        },
      },
    },
  });

  if (!existing) {
    return NextResponse.json({ error: "Pagamento non trovato." }, { status: 404 });
  }

  if (existing.enrollment.athlete.parent.userId !== session.user.id) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  if (existing.type !== "DEPOSIT" && existing.type !== "BALANCE") {
    return NextResponse.json(
      { error: "Ricevuta disponibile solo per acconto o saldo iscrizione." },
      { status: 400 },
    );
  }

  const now = new Date();
  const athleteFullName =
    `${existing.enrollment.athlete.firstName} ${existing.enrollment.athlete.lastName}`.trim();
  const headerFullName =
    `${existing.enrollment.receiptFirstName} ${existing.enrollment.receiptLastName}`.trim();

  console.info("[payments:mark-paid] Start", {
    paymentId,
    userId: session.user.id,
    currentStatus: existing.status,
  });

  // Step 1 - update payment
  let updatedPayment: {
    id: string;
    amount: Prisma.Decimal;
    type: "DEPOSIT" | "BALANCE" | "OTHER";
    paymentMethod: string | null;
    paidAt: Date | null;
  };
  try {
    updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "PAID",
        paidAt: existing.paidAt ?? now,
        paymentMethod,
      },
      select: {
        id: true,
        amount: true,
        type: true,
        paymentMethod: true,
        paidAt: true,
      },
    });
    console.info("[payments:mark-paid] Payment updated", {
      paymentId,
      status: "PAID",
      paidAt: updatedPayment.paidAt?.toISOString() ?? null,
      paymentMethod: updatedPayment.paymentMethod ?? null,
    });
  } catch (error) {
    console.error("[payments:mark-paid] Payment update failed", {
      paymentId,
      userId: session.user.id,
      error: toErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Errore database durante aggiornamento pagamento." },
      { status: 500 },
    );
  }

  // Optional bookkeeping integration: keep accounting income aligned with paid enrollment payments.
  try {
    await prisma.accountingEntry.upsert({
      where: { paymentId: updatedPayment.id },
      update: {
        type: "INCOME",
        category: "iscrizioni",
        description: `Pagamento iscrizione ${athleteFullName}`,
        amount: updatedPayment.amount,
        date: updatedPayment.paidAt ?? now,
        paymentMethod: updatedPayment.paymentMethod,
        isForecast: false,
        notes: `Generato automaticamente dal pagamento ${updatedPayment.type}`,
      },
      create: {
        type: "INCOME",
        category: "iscrizioni",
        description: `Pagamento iscrizione ${athleteFullName}`,
        amount: updatedPayment.amount,
        date: updatedPayment.paidAt ?? now,
        paymentMethod: updatedPayment.paymentMethod,
        isForecast: false,
        notes: `Generato automaticamente dal pagamento ${updatedPayment.type}`,
        createdById: session.user.id,
        paymentId: updatedPayment.id,
      },
      select: { id: true },
    });
  } catch (error) {
    console.warn("[payments:mark-paid] Accounting sync skipped", {
      paymentId,
      error: toErrorMessage(error),
    });
  }

  const issueDate = existing.receipt?.issueDate ?? (updatedPayment.paidAt ?? now);
  const seasonLabel = SPORT_SEASON;
  let receiptNumber = existing.receipt?.receiptNumber ?? "";
  if (!receiptNumber) {
    try {
      receiptNumber = await getNextReceiptNumber(issueDate);
    } catch (error) {
      console.error("[payments:mark-paid] Receipt number generation failed", {
        paymentId,
        userId: session.user.id,
        error: toErrorMessage(error),
      });
      return NextResponse.json(
        { error: "Errore database durante generazione numero ricevuta." },
        { status: 500 },
      );
    }
  }

  const paymentMethodToPrint = updatedPayment.paymentMethod?.trim() || undefined;
  const amountAsString = updatedPayment.amount.toString();
  const paymentTypeForReceipt = updatedPayment.type === "DEPOSIT" ? "DEPOSIT" : "BALANCE";

  // Step 2 - generate PDF
  let pdfBuffer: Buffer;
  let receiptRelativePath = "";
  let fileName = "";
  try {
    const pdfBytes = await generateReceiptPdf({
      receiptNumber,
      issueDate,
      companyName: CLUB_DATA.name,
      companyAddress: CLUB_DATA.address,
      companyCityPostalCode: CLUB_DATA.cityPostalCode,
      companyVatOrTaxCode: CLUB_DATA.vatOrTaxCode,
      athleteFullName,
      parentFullName: headerFullName,
      paymentType: paymentTypeForReceipt,
      categoryName: existing.enrollment.category.name,
      seasonLabel,
      amount: amountAsString,
      paymentMethod: paymentMethodToPrint,
    });

    fileName = `${receiptNumber}.pdf`;
    const storage = getReceiptStoragePaths(fileName);
    receiptRelativePath = storage.relativePath;
    pdfBuffer = Buffer.from(pdfBytes);

    await mkdir(storage.absoluteDir, { recursive: true });
    await writeFile(storage.absolutePath, pdfBuffer);

    console.info("[payments:mark-paid] PDF generated", {
      paymentId,
      receiptNumber,
      filePath: receiptRelativePath,
    });
  } catch (error) {
    console.error("[payments:mark-paid] PDF generation failed", {
      paymentId,
      userId: session.user.id,
      receiptNumber,
      error: toErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Errore nella generazione PDF della ricevuta." },
      { status: 500 },
    );
  }

  // Step 3 - save receipt in database
  let receiptId = existing.receipt?.id ?? "";
  try {
    if (existing.receipt) {
      const updatedReceipt = await prisma.receipt.update({
        where: { id: existing.receipt.id },
        data: {
          issueDate,
          amount: updatedPayment.amount,
          headerName: headerFullName,
          headerTaxCode: existing.enrollment.receiptTaxCode,
          filePath: receiptRelativePath,
        },
        select: {
          id: true,
        },
      });
      receiptId = updatedReceipt.id;
    } else {
      const createdReceipt = await prisma.receipt.create({
        data: {
          paymentId: updatedPayment.id,
          receiptNumber,
          issueDate,
          amount: updatedPayment.amount,
          headerName: headerFullName,
          headerTaxCode: existing.enrollment.receiptTaxCode,
          filePath: receiptRelativePath,
        },
        select: {
          id: true,
        },
      });
      receiptId = createdReceipt.id;
    }
    console.info("[payments:mark-paid] Receipt saved", {
      paymentId,
      receiptId,
      receiptNumber,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error("[payments:mark-paid] Receipt number conflict", {
        paymentId,
        receiptNumber,
        error: toErrorMessage(error),
      });
      return NextResponse.json(
        { error: "Conflitto su numero ricevuta. Riprova tra qualche secondo." },
        { status: 409 },
      );
    }

    console.error("[payments:mark-paid] Receipt save failed", {
      paymentId,
      userId: session.user.id,
      receiptNumber,
      error: toErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Errore database durante salvataggio ricevuta." },
      { status: 500 },
    );
  }

  // Step 4 - send email (non-blocking for receipt persistence)
  const societyEmail = process.env.CLUB_RECEIPTS_EMAIL;
  try {
    const mailResult = await sendReceiptMail({
      to: existing.enrollment.receiptEmail,
      cc: societyEmail,
      receiptNumber,
      athleteFullName,
      amount: amountAsString,
      attachmentFileName: fileName,
      attachmentContent: pdfBuffer,
    });

    if (mailResult.sent) {
      console.info("[payments:mark-paid] Email sent", {
        paymentId,
        receiptId,
        receiptNumber,
        to: existing.enrollment.receiptEmail,
      });
      return NextResponse.json(
        {
          success: true,
          status: "PAID_RECEIPT_EMAIL_SENT",
          message: "Pagamento aggiornato, ricevuta generata e email inviata.",
          paymentId,
          receiptId,
          receiptNumber,
          receiptFilePath: receiptRelativePath,
          emailSent: true,
        },
        { status: 200 },
      );
    }

    console.warn("[payments:mark-paid] Email skipped", {
      paymentId,
      receiptId,
      receiptNumber,
      reason: mailResult.reason,
    });
    return NextResponse.json(
      {
        success: true,
        status: "PAID_RECEIPT_EMAIL_SKIPPED",
        message: "Pagamento aggiornato e ricevuta generata. Email non inviata.",
        paymentId,
        receiptId,
        receiptNumber,
        receiptFilePath: receiptRelativePath,
        emailSent: false,
        emailError: mailResult.reason,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[payments:mark-paid] Email send failed", {
      paymentId,
      receiptId,
      receiptNumber,
      error: toErrorMessage(error),
    });
    return NextResponse.json(
      {
        success: true,
        status: "PAID_RECEIPT_EMAIL_FAILED",
        message: "Pagamento aggiornato e ricevuta generata. Invio email fallito.",
        paymentId,
        receiptId,
        receiptNumber,
        receiptFilePath: receiptRelativePath,
        emailSent: false,
      },
      { status: 200 },
    );
  }
}
