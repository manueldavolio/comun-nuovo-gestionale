import { Prisma, type PaymentType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateReceiptPdf } from "@/lib/pdf";
import { sendReceiptMail } from "@/lib/mail";
import { saveReceiptPdf } from "@/lib/receipt-storage";

const CLUB_DATA = {
  name: "Associazione Sportiva Dilettantistica Comun Nuovo",
  address: "Via Azzurri 2006 snc",
  cityPostalCode: "24040 Comun Nuovo",
  vatOrTaxCode: "04232930166",
} as const;

const RECEIPT_SEQUENCE_PAD = 6;
const RECEIPT_COUNTER_ID = 1;

type PaymentWithRelations = {
  id: string;
  amount: Prisma.Decimal;
  type: PaymentType;
  status: "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
  paidAt: Date | null;
  paymentMethod: string | null;
  receipt: { id: string; receiptNumber: string; filePath: string | null } | null;
  enrollment: {
    seasonLabel: string;
    receiptFirstName: string;
    receiptLastName: string;
    receiptTaxCode: string;
    receiptAddress: string;
    receiptEmail: string;
    category: { name: string };
    athlete: {
      firstName: string;
      lastName: string;
      taxCode: string;
      birthDate: Date;
    };
  };
};

function buildCausal(paymentType: PaymentType, seasonLabel: string) {
  return paymentType === "DEPOSIT"
    ? `Acconto iscrizione stagione ${seasonLabel}`
    : `Saldo iscrizione stagione ${seasonLabel}`;
}

async function getNextReceiptNumber(tx: Prisma.TransactionClient): Promise<string> {
  await tx.receiptCounter.upsert({
    where: { id: RECEIPT_COUNTER_ID },
    create: { id: RECEIPT_COUNTER_ID, lastValue: 0 },
    update: {},
  });

  const rows = await tx.$queryRaw<Array<{ lastValue: number }>>`
    UPDATE "ReceiptCounter"
    SET "lastValue" = "lastValue" + 1
    WHERE "id" = ${RECEIPT_COUNTER_ID}
    RETURNING "lastValue"
  `;

  const nextValue = rows[0]?.lastValue ?? 1;
  return `CN-${String(nextValue).padStart(RECEIPT_SEQUENCE_PAD, "0")}`;
}

async function ensureReceiptFile(payment: PaymentWithRelations) {
  if (!payment.receipt) {
    return null;
  }

  const fileName = `${payment.receipt.receiptNumber}.pdf`;
  const athleteFullName = `${payment.enrollment.athlete.firstName} ${payment.enrollment.athlete.lastName}`.trim();
  const parentFullName = `${payment.enrollment.receiptFirstName} ${payment.enrollment.receiptLastName}`.trim();

  console.info("[receipts] payment id", { paymentId: payment.id });
  console.info("[receipts] receipt id", { receiptId: payment.receipt.id });

  const pdfBytes = await generateReceiptPdf({
    receiptNumber: payment.receipt.receiptNumber,
    issueDate: payment.paidAt ?? new Date(),
    companyName: CLUB_DATA.name,
    companyAddress: CLUB_DATA.address,
    companyCityPostalCode: CLUB_DATA.cityPostalCode,
    companyVatOrTaxCode: CLUB_DATA.vatOrTaxCode,
    athleteFullName,
    athleteTaxCode: payment.enrollment.athlete.taxCode,
    athleteBirthDate: payment.enrollment.athlete.birthDate,
    parentFullName,
    parentTaxCode: payment.enrollment.receiptTaxCode,
    parentAddress: payment.enrollment.receiptAddress,
    paymentType: payment.type === "DEPOSIT" ? "DEPOSIT" : "BALANCE",
    categoryName: payment.enrollment.category.name,
    seasonLabel: payment.enrollment.seasonLabel,
    amount: payment.amount.toString(),
    paymentMethod: payment.paymentMethod ?? "Stripe",
  });

  const pdfBuffer = Buffer.from(pdfBytes);
  const savedPath = await saveReceiptPdf(fileName, pdfBuffer);
  console.info("[receipts] generated pdf path", { generatedPdfPath: savedPath });

  if (payment.receipt.filePath !== savedPath) {
    await prisma.receipt.update({
      where: { id: payment.receipt.id },
      data: { filePath: savedPath },
    });
  }
  console.info("[receipts] saved file path in DB", { filePath: savedPath });

  const societyEmail = process.env.CLUB_RECEIPTS_EMAIL;
  await sendReceiptMail({
    to: payment.enrollment.receiptEmail,
    cc: societyEmail,
    receiptNumber: payment.receipt.receiptNumber,
    athleteFullName,
    amount: payment.amount.toString(),
    attachmentFileName: fileName,
    attachmentContent: pdfBuffer,
  }).catch(() => undefined);

  return savedPath;
}

export async function regenerateReceiptForPaidPayment(paymentId: string) {
  const now = new Date();

  const payment = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        amount: true,
        type: true,
        status: true,
        paidAt: true,
        paymentMethod: true,
        receipt: {
          select: { id: true, receiptNumber: true, filePath: true },
        },
        enrollment: {
          select: {
            seasonLabel: true,
            receiptFirstName: true,
            receiptLastName: true,
            receiptTaxCode: true,
            receiptAddress: true,
            receiptEmail: true,
            category: { select: { name: true } },
            athlete: {
              select: {
                firstName: true,
                lastName: true,
                taxCode: true,
                birthDate: true,
                parent: {
                  select: {
                    id: true,
                    user: {
                      select: {
                        id: true,
                        email: true,
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

    if (!existing) {
      return null;
    }

    if (existing.status !== "PAID") {
      return { error: "PAYMENT_NOT_PAID" as const };
    }

    if (existing.type !== "DEPOSIT" && existing.type !== "BALANCE") {
      return { error: "PAYMENT_TYPE_NOT_SUPPORTED" as const };
    }

    if (!existing.receipt) {
      const receiptNumber = await getNextReceiptNumber(tx);
      await tx.receipt.create({
        data: {
          paymentId: existing.id,
          receiptNumber,
          issueDate: existing.paidAt ?? now,
          amount: existing.amount,
          causal: buildCausal(existing.type, existing.enrollment.seasonLabel),
          paymentProvider: "Stripe",
          headerName: `${existing.enrollment.receiptFirstName} ${existing.enrollment.receiptLastName}`.trim(),
          headerTaxCode: existing.enrollment.receiptTaxCode,
        },
      });
    }

    return tx.payment.findUnique({
      where: { id: existing.id },
      select: {
        id: true,
        amount: true,
        type: true,
        status: true,
        paidAt: true,
        paymentMethod: true,
        receipt: {
          select: { id: true, receiptNumber: true, filePath: true },
        },
        enrollment: {
          select: {
            seasonLabel: true,
            receiptFirstName: true,
            receiptLastName: true,
            receiptTaxCode: true,
            receiptAddress: true,
            receiptEmail: true,
            category: { select: { name: true } },
            athlete: {
              select: {
                firstName: true,
                lastName: true,
                taxCode: true,
                birthDate: true,
              },
            },
          },
        },
      },
    });
  });

  if (!payment) {
    return { error: "PAYMENT_NOT_FOUND" as const };
  }

  if ("error" in payment) {
    return payment;
  }

  const filePath = await ensureReceiptFile(payment as PaymentWithRelations);
  return {
    ok: true as const,
    receiptId: payment.receipt?.id ?? null,
    filePath: filePath ?? payment.receipt?.filePath ?? null,
  };
}

export async function markEnrollmentPaymentPaidFromStripe(input: {
  paymentId: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
}) {
  const now = new Date();

  const payment = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        amount: true,
        type: true,
        status: true,
        paidAt: true,
        paymentMethod: true,
        receipt: {
          select: { id: true, receiptNumber: true, filePath: true },
        },
        enrollment: {
          select: {
            seasonLabel: true,
            receiptFirstName: true,
            receiptLastName: true,
            receiptTaxCode: true,
            receiptAddress: true,
            receiptEmail: true,
            category: { select: { name: true } },
            athlete: {
              select: {
                firstName: true,
                lastName: true,
                taxCode: true,
                birthDate: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      return null;
    }

    if (existing.type !== "DEPOSIT" && existing.type !== "BALANCE") {
      return null;
    }

    const paidAt = existing.paidAt ?? now;
    const updatedPayment = await tx.payment.update({
      where: { id: existing.id },
      data: {
        status: "PAID",
        paidAt,
        paymentMethod: "Online / Stripe",
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId,
      },
      select: {
        id: true,
        amount: true,
        type: true,
        status: true,
        paidAt: true,
        paymentMethod: true,
        receipt: {
          select: { id: true, receiptNumber: true, filePath: true },
        },
        enrollment: {
          select: {
            seasonLabel: true,
            receiptFirstName: true,
            receiptLastName: true,
            receiptTaxCode: true,
            receiptAddress: true,
            receiptEmail: true,
            category: { select: { name: true } },
            athlete: {
              select: {
                firstName: true,
                lastName: true,
                taxCode: true,
                birthDate: true,
              },
            },
          },
        },
      },
    });

    const athleteFullName =
      `${updatedPayment.enrollment.athlete.firstName} ${updatedPayment.enrollment.athlete.lastName}`.trim();

    await tx.accountingEntry.upsert({
      where: { paymentId: updatedPayment.id },
      update: {
        type: "INCOME",
        category: "iscrizioni",
        description: `Pagamento iscrizione ${athleteFullName}`,
        amount: updatedPayment.amount,
        date: paidAt,
        paymentMethod: "Online / Stripe",
        isForecast: false,
      },
      create: {
        type: "INCOME",
        category: "iscrizioni",
        description: `Pagamento iscrizione ${athleteFullName}`,
        amount: updatedPayment.amount,
        date: paidAt,
        paymentMethod: "Online / Stripe",
        isForecast: false,
        paymentId: updatedPayment.id,
      },
    });

    if (!updatedPayment.receipt) {
      const receiptNumber = await getNextReceiptNumber(tx);
      await tx.receipt.create({
        data: {
          paymentId: updatedPayment.id,
          receiptNumber,
          issueDate: paidAt,
          amount: updatedPayment.amount,
          causal: buildCausal(updatedPayment.type, updatedPayment.enrollment.seasonLabel),
          paymentProvider: "Stripe",
          headerName: `${updatedPayment.enrollment.receiptFirstName} ${updatedPayment.enrollment.receiptLastName}`.trim(),
          headerTaxCode: updatedPayment.enrollment.receiptTaxCode,
        },
      });
    }

    return tx.payment.findUnique({
      where: { id: updatedPayment.id },
      select: {
        id: true,
        amount: true,
        type: true,
        status: true,
        paidAt: true,
        paymentMethod: true,
        receipt: {
          select: { id: true, receiptNumber: true, filePath: true },
        },
        enrollment: {
          select: {
            seasonLabel: true,
            receiptFirstName: true,
            receiptLastName: true,
            receiptTaxCode: true,
            receiptAddress: true,
            receiptEmail: true,
            category: { select: { name: true } },
            athlete: {
              select: {
                firstName: true,
                lastName: true,
                taxCode: true,
                birthDate: true,
              },
            },
          },
        },
      },
    });
  });

  if (!payment) {
    return null;
  }

  const filePath = await ensureReceiptFile(payment as PaymentWithRelations);
  return {
    paymentId: payment.id,
    receiptId: payment.receipt?.id ?? null,
    receiptNumber: payment.receipt?.receiptNumber ?? null,
    receiptFilePath: filePath ?? payment.receipt?.filePath ?? null,
  };
}
