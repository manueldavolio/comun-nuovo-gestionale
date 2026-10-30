import { Prisma, type BankTransferRequestStatus } from "@prisma/client";
import {
  EnrollmentFeesConfigError,
  resolveCategoryEnrollmentFees,
  resolveCheckoutChargeAmount,
  shouldCancelUnpaidDepositAfterBalancePaid,
} from "@/lib/enrollment-fees";
import { prisma } from "@/lib/prisma";
import { generateReceiptPdf } from "@/lib/pdf";
import { saveReceiptPdf } from "@/lib/receipt-storage";
import { isEnrollmentPaymentCheckoutRetryable } from "@/lib/stripe-checkout-expiry-policy";

export const BANK_TRANSFER_PAYMENT_METHOD = "BANK_TRANSFER";
export const BANK_TRANSFER_PAYMENT_METHOD_LABEL = "Bonifico bancario";

const CLUB_DATA = {
  name: "Associazione Sportiva Dilettantistica Comun Nuovo",
  address: "Via Azzurri 2006 snc",
  cityPostalCode: "24040 Comun Nuovo",
  vatOrTaxCode: "04232930166",
} as const;

const RECEIPT_SEQUENCE_PAD = 6;
const RECEIPT_COUNTER_ID = 1;

const OPEN_BANK_TRANSFER_STATUSES: BankTransferRequestStatus[] = [
  "AWAITING_PROOF",
  "UNDER_REVIEW",
  "REJECTED",
];

export function normalizeIban(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function isPlausibleIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  return /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban);
}

export function formatIbanForDisplay(raw: string): string {
  const iban = normalizeIban(raw);
  return iban.replace(/(.{4})/g, "$1 ").trim();
}

export function buildBankTransferCausal(paymentId: string, requestId: string): string {
  const shortPayment = paymentId.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase();
  const shortRequest = requestId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `CN-BON-${shortPayment}-${shortRequest}`;
}

export function bankTransferStatusLabel(status: BankTransferRequestStatus): string {
  switch (status) {
    case "AWAITING_PROOF":
      return "In attesa di contabile";
    case "UNDER_REVIEW":
      return "Bonifico in verifica";
    case "APPROVED":
      return "Bonifico approvato";
    case "REJECTED":
      return "Contabile respinta";
    case "SUPERSEDED":
      return "Bonifico superato";
    default:
      return status;
  }
}

export async function getClubBankSettings() {
  return prisma.clubBankSettings.findUnique({
    where: { id: "main" },
    select: { id: true, beneficiary: true, iban: true, updatedAt: true },
  });
}

export async function upsertClubBankSettings(input: {
  beneficiary: string;
  iban: string;
  updatedById: string;
}) {
  const beneficiary = input.beneficiary.trim();
  const iban = normalizeIban(input.iban);
  if (!beneficiary) {
    return { error: "BENEFICIARY_REQUIRED" as const };
  }
  if (!isPlausibleIban(iban)) {
    return { error: "IBAN_INVALID" as const };
  }

  const settings = await prisma.clubBankSettings.upsert({
    where: { id: "main" },
    create: {
      id: "main",
      beneficiary,
      iban,
      updatedById: input.updatedById,
    },
    update: {
      beneficiary,
      iban,
      updatedById: input.updatedById,
    },
    select: { id: true, beneficiary: true, iban: true, updatedAt: true },
  });

  return { ok: true as const, settings };
}

function buildCausal(paymentType: "DEPOSIT" | "BALANCE", seasonLabel: string) {
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

async function resolvePayableChargeAmount(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      type: true,
      status: true,
      amount: true,
      stripeCheckoutSessionId: true,
      stripePaymentIntentId: true,
      enrollment: {
        select: {
          category: {
            select: { depositFee: true, balanceFee: true, annualFee: true },
          },
          payments: {
            select: { id: true, type: true, status: true, amount: true },
          },
        },
      },
    },
  });

  if (!payment) return { ok: false as const, error: "PAYMENT_NOT_FOUND" as const };
  if (payment.type !== "DEPOSIT" && payment.type !== "BALANCE") {
    return { ok: false as const, error: "PAYMENT_TYPE_NOT_SUPPORTED" as const };
  }
  if (payment.status === "PAID") {
    return { ok: false as const, error: "PAYMENT_ALREADY_PAID" as const };
  }
  if (
    !isEnrollmentPaymentCheckoutRetryable({
      type: payment.type,
      status: payment.status,
      hasStripePaymentIntent: Boolean(payment.stripePaymentIntentId?.trim()),
      hasStripeCheckoutSessionId: Boolean(payment.stripeCheckoutSessionId?.trim()),
    })
  ) {
    return { ok: false as const, error: "PAYMENT_STATUS_NOT_RETRYABLE" as const };
  }

  let fees;
  try {
    fees = resolveCategoryEnrollmentFees({
      depositFee: payment.enrollment.category.depositFee,
      balanceFee: payment.enrollment.category.balanceFee,
      annualFee: payment.enrollment.category.annualFee,
    });
  } catch (error) {
    if (error instanceof EnrollmentFeesConfigError) {
      return {
        ok: false as const,
        error: "ENROLLMENT_FEES_CONFIG" as const,
        message: error.message,
      };
    }
    throw error;
  }

  let chargeAmount: string;
  try {
    chargeAmount = resolveCheckoutChargeAmount({
      paymentType: payment.type,
      paymentAmount: payment.amount,
      paymentStatus: payment.status === "CANCELLED" ? "PENDING" : payment.status,
      annualFee: fees.annual,
      enrollmentPayments: payment.enrollment.payments,
    });
  } catch (error) {
    if (error instanceof EnrollmentFeesConfigError) {
      return {
        ok: false as const,
        error: "ENROLLMENT_FEES_CONFIG" as const,
        message: error.message,
      };
    }
    throw error;
  }

  if (Number(chargeAmount) <= 0) {
    return {
      ok: false as const,
      error: "ENROLLMENT_FEES_CONFIG" as const,
      message: "Nessun importo da addebitare.",
    };
  }

  return {
    ok: true as const,
    payment,
    chargeAmount,
    chargeDecimal: new Prisma.Decimal(chargeAmount),
  };
}

export async function createOrReuseBankTransferRequest(input: {
  paymentId: string;
  createdById: string;
}) {
  const settings = await getClubBankSettings();
  if (!settings || !settings.beneficiary.trim() || !settings.iban.trim()) {
    return { ok: false as const, error: "BANK_SETTINGS_MISSING" as const };
  }

  const resolved = await resolvePayableChargeAmount(input.paymentId);
  if (!resolved.ok) return resolved;

  const { payment, chargeDecimal } = resolved;

  const existingOpen = await prisma.bankTransferRequest.findFirst({
    where: {
      paymentId: input.paymentId,
      status: { in: OPEN_BANK_TRANSFER_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingOpen) {
    if (!existingOpen.amount.equals(chargeDecimal)) {
      await prisma.bankTransferRequest.update({
        where: { id: existingOpen.id },
        data: { amount: chargeDecimal },
      });
    }
    return {
      ok: true as const,
      request: await prisma.bankTransferRequest.findUniqueOrThrow({
        where: { id: existingOpen.id },
      }),
      settings,
      reused: true as const,
    };
  }

  const requestId = `bt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const causal = buildBankTransferCausal(input.paymentId, requestId);

  const request = await prisma.$transaction(async (tx) => {
    const stillUnpaid = await tx.payment.findFirst({
      where: { id: input.paymentId, status: { not: "PAID" } },
      select: { id: true },
    });
    if (!stillUnpaid) {
      return null;
    }

    if (!payment.amount.equals(chargeDecimal)) {
      await tx.payment.updateMany({
        where: { id: input.paymentId, status: { not: "PAID" } },
        data: { amount: chargeDecimal },
      });
    }

    return tx.bankTransferRequest.create({
      data: {
        id: requestId,
        paymentId: input.paymentId,
        amount: chargeDecimal,
        causal,
        status: "AWAITING_PROOF",
        createdById: input.createdById,
      },
    });
  });

  if (!request) {
    return { ok: false as const, error: "PAYMENT_ALREADY_PAID" as const };
  }

  return { ok: true as const, request, settings, reused: false as const };
}

export async function attachBankTransferProof(input: {
  requestId: string;
  actorUserId: string;
  objectPath: string;
  mimeType: string;
}) {
  const request = await prisma.bankTransferRequest.findUnique({
    where: { id: input.requestId },
    select: {
      id: true,
      status: true,
      createdById: true,
      payment: { select: { status: true } },
    },
  });

  if (!request) return { error: "REQUEST_NOT_FOUND" as const };
  if (request.createdById !== input.actorUserId) {
    return { error: "FORBIDDEN" as const };
  }
  if (request.payment.status === "PAID") {
    return { error: "PAYMENT_ALREADY_PAID" as const };
  }
  if (request.status !== "AWAITING_PROOF" && request.status !== "REJECTED") {
    return { error: "REQUEST_STATUS_INVALID" as const };
  }

  const updated = await prisma.bankTransferRequest.update({
    where: { id: request.id },
    data: {
      status: "UNDER_REVIEW",
      proofFilePath: input.objectPath,
      proofMimeType: input.mimeType,
      proofUploadedAt: new Date(),
      rejectionReason: null,
      reviewedAt: null,
      reviewedById: null,
    },
  });

  return { ok: true as const, request: updated };
}

export async function rejectBankTransferRequest(input: {
  requestId: string;
  reviewedById: string;
  reason: string;
}) {
  const reason = input.reason.trim();
  if (!reason) return { error: "REASON_REQUIRED" as const };

  const request = await prisma.bankTransferRequest.findUnique({
    where: { id: input.requestId },
    select: { id: true, status: true, payment: { select: { status: true } } },
  });
  if (!request) return { error: "REQUEST_NOT_FOUND" as const };
  if (request.status !== "UNDER_REVIEW") {
    return { error: "REQUEST_STATUS_INVALID" as const };
  }
  if (request.payment.status === "PAID") {
    return { error: "PAYMENT_ALREADY_PAID" as const };
  }

  const updated = await prisma.bankTransferRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      rejectionReason: reason,
      reviewedAt: new Date(),
      reviewedById: input.reviewedById,
    },
  });

  return { ok: true as const, request: updated };
}

export async function approveBankTransferRequest(input: {
  requestId: string;
  reviewedById: string;
}) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.bankTransferRequest.findUnique({
      where: { id: input.requestId },
      select: {
        id: true,
        status: true,
        amount: true,
        paymentId: true,
        payment: {
          select: {
            id: true,
            type: true,
            status: true,
            amount: true,
            paidAt: true,
            paymentMethod: true,
            notes: true,
            receipt: { select: { id: true } },
            enrollment: {
              select: {
                id: true,
                seasonLabel: true,
                receiptFirstName: true,
                receiptLastName: true,
                receiptTaxCode: true,
                receiptAddress: true,
                receiptEmail: true,
                category: { select: { name: true } },
                payments: { select: { id: true, type: true, status: true } },
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
        },
      },
    });

    if (!request) return { error: "REQUEST_NOT_FOUND" as const };
    if (request.status !== "UNDER_REVIEW") {
      return { error: "REQUEST_STATUS_INVALID" as const };
    }

    // Stripe (or prior approval) already won: never double-account.
    if (request.payment.status === "PAID") {
      await tx.bankTransferRequest.update({
        where: { id: request.id },
        data: {
          status: "SUPERSEDED",
          reviewedAt: now,
          reviewedById: input.reviewedById,
          rejectionReason: "Pagamento già registrato con altro metodo.",
        },
      });
      return { error: "PAYMENT_ALREADY_PAID" as const };
    }

    if (request.payment.type !== "DEPOSIT" && request.payment.type !== "BALANCE") {
      return { error: "PAYMENT_TYPE_NOT_SUPPORTED" as const };
    }

    const paidAt = request.payment.paidAt ?? now;
    const updatedPayment = await tx.payment.update({
      where: { id: request.payment.id },
      data: {
        status: "PAID",
        paidAt,
        paymentMethod: BANK_TRANSFER_PAYMENT_METHOD_LABEL,
        amount: request.amount,
        notes: [request.payment.notes, `[${now.toISOString().slice(0, 19)}] Bonifico approvato (richiesta ${request.id}).`]
          .filter(Boolean)
          .join("\n"),
      },
      select: {
        id: true,
        amount: true,
        type: true,
        status: true,
        paidAt: true,
        paymentMethod: true,
        receipt: { select: { id: true, receiptNumber: true, filePath: true } },
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

    await tx.bankTransferRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedAt: now,
        reviewedById: input.reviewedById,
        rejectionReason: null,
      },
    });

    // Close sibling open requests for same payment.
    await tx.bankTransferRequest.updateMany({
      where: {
        paymentId: request.paymentId,
        id: { not: request.id },
        status: { in: OPEN_BANK_TRANSFER_STATUSES },
      },
      data: {
        status: "SUPERSEDED",
        reviewedAt: now,
        reviewedById: input.reviewedById,
        rejectionReason: "Chiuso: bonifico approvato su altra richiesta.",
      },
    });

    if (request.payment.type === "BALANCE") {
      const deposit = request.payment.enrollment.payments.find((row) => row.type === "DEPOSIT");
      if (
        shouldCancelUnpaidDepositAfterBalancePaid({
          balanceJustPaid: true,
          depositStatus: deposit?.status,
        }) &&
        deposit
      ) {
        await tx.payment.update({
          where: { id: deposit.id },
          data: {
            status: "CANCELLED",
            notes: "Annullato: iscrizione già coperta dal pagamento completo/saldo.",
          },
        });
      }
    }

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
        paymentMethod: BANK_TRANSFER_PAYMENT_METHOD_LABEL,
        isForecast: false,
        createdById: input.reviewedById,
      },
      create: {
        type: "INCOME",
        category: "iscrizioni",
        description: `Pagamento iscrizione ${athleteFullName}`,
        amount: updatedPayment.amount,
        date: paidAt,
        paymentMethod: BANK_TRANSFER_PAYMENT_METHOD_LABEL,
        isForecast: false,
        paymentId: updatedPayment.id,
        createdById: input.reviewedById,
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
          causal: buildCausal(
            updatedPayment.type === "DEPOSIT" ? "DEPOSIT" : "BALANCE",
            updatedPayment.enrollment.seasonLabel,
          ),
          paymentProvider: BANK_TRANSFER_PAYMENT_METHOD,
          headerName:
            `${updatedPayment.enrollment.receiptFirstName} ${updatedPayment.enrollment.receiptLastName}`.trim(),
          headerTaxCode: updatedPayment.enrollment.receiptTaxCode,
        },
      });
    }

    return {
      ok: true as const,
      paymentId: updatedPayment.id,
    };
  });

  if (!("ok" in result)) return result;

  const payment = await prisma.payment.findUnique({
    where: { id: result.paymentId },
    select: {
      id: true,
      amount: true,
      type: true,
      status: true,
      paidAt: true,
      paymentMethod: true,
      receipt: { select: { id: true, receiptNumber: true, filePath: true } },
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

  if (!payment?.receipt) {
    return { ok: true as const, paymentId: result.paymentId, receiptId: null };
  }

  const athleteFullName =
    `${payment.enrollment.athlete.firstName} ${payment.enrollment.athlete.lastName}`.trim();
  const parentFullName =
    `${payment.enrollment.receiptFirstName} ${payment.enrollment.receiptLastName}`.trim();

  const pdfBytes = await generateReceiptPdf({
    receiptNumber: payment.receipt.receiptNumber,
    issueDate: payment.paidAt ?? now,
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
    paymentMethod: BANK_TRANSFER_PAYMENT_METHOD_LABEL,
  });

  const savedPath = await saveReceiptPdf(
    `${payment.receipt.receiptNumber}.pdf`,
    Buffer.from(pdfBytes),
  );
  if (payment.receipt.filePath !== savedPath) {
    await prisma.receipt.update({
      where: { id: payment.receipt.id },
      data: { filePath: savedPath },
    });
  }

  return {
    ok: true as const,
    paymentId: payment.id,
    receiptId: payment.receipt.id,
  };
}

/** When Stripe marks PAID, supersede open bank-transfer requests (no double accounting). */
export async function supersedeOpenBankTransfersForPayment(input: {
  paymentId: string;
  reason: string;
}) {
  await prisma.bankTransferRequest.updateMany({
    where: {
      paymentId: input.paymentId,
      status: { in: ["AWAITING_PROOF", "UNDER_REVIEW", "REJECTED"] },
    },
    data: {
      status: "SUPERSEDED",
      reviewedAt: new Date(),
      rejectionReason: input.reason,
    },
  });
}
