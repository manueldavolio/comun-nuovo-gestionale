import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { enrollmentSchema } from "@/lib/validation/enrollment";
import {
  applyUploadedEnrollmentDocumentMetadata,
  parseEnrollmentDocumentReferences,
  validateEnrollmentDocumentReferences,
} from "@/lib/validation/enrollment-files";
import {
  EnrollmentDocumentStorageError,
  validateEnrollmentDocumentStorageEnv,
} from "@/lib/enrollment-documents";

export const runtime = "nodejs";

const DEPOSIT_DUE_DATE = new Date("2026-06-30T00:00:00.000Z");
const BALANCE_DUE_DATE = new Date("2026-09-30T00:00:00.000Z");
const DEFAULT_CATEGORY_ID = "__DEFAULT_CATEGORY__";
const DEFAULT_CATEGORY_NAME = "Iscrizione generale";
const DEFAULT_BIRTH_YEARS_LABEL = "Tutte le annate";

function getDefaultSeasonLabel() {
  const now = new Date();
  const year = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}/${year + 1}`;
}

async function getFallbackCategory(tx: Prisma.TransactionClient) {
  const seasonLabel = getDefaultSeasonLabel();

  return tx.category.upsert({
    where: {
      name_seasonLabel: {
        name: DEFAULT_CATEGORY_NAME,
        seasonLabel,
      },
    },
    update: {
      birthYearsLabel: DEFAULT_BIRTH_YEARS_LABEL,
      annualFee: new Prisma.Decimal("0.00"),
      depositFee: new Prisma.Decimal("0.00"),
      balanceFee: new Prisma.Decimal("0.00"),
      isActive: true,
    },
    create: {
      name: DEFAULT_CATEGORY_NAME,
      birthYearsLabel: DEFAULT_BIRTH_YEARS_LABEL,
      seasonLabel,
      annualFee: new Prisma.Decimal("0.00"),
      depositFee: new Prisma.Decimal("0.00"),
      balanceFee: new Prisma.Decimal("0.00"),
      isActive: true,
    },
    select: {
      id: true,
      seasonLabel: true,
    },
  });
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const contentLengthHeader = request.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : null;

  if (!contentType.toLowerCase().includes("application/json")) {
    console.error("[enrollments] richiesta rifiutata: Content-Type non JSON", {
      contentType,
      contentLength,
    });
    return NextResponse.json(
      {
        error:
          "Formato richiesta non valido. Invia solo JSON con i riferimenti ai documenti già caricati.",
      },
      { status: 415 },
    );
  }

  if (contentLength !== null && Number.isFinite(contentLength) && contentLength > 512_000) {
    console.error("[enrollments] payload troppo grande per iscrizione JSON", {
      contentLength,
      contentType,
    });
    return NextResponse.json(
      {
        error:
          "Payload iscrizione troppo grande. Carica i documenti su /api/genitore/enrollment-documents/upload e invia solo i percorsi.",
      },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    console.error("[enrollments] parsing JSON fallito", { contentType, contentLength });
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  console.info("[enrollments] payload JSON ricevuto (senza file)", {
    contentType,
    contentLength,
    hasDocuments: Boolean(body && typeof body === "object" && "documents" in body),
    uploadedDocumentsCount:
      body &&
      typeof body === "object" &&
      Array.isArray((body as Record<string, unknown>).uploadedDocuments)
        ? (body as Record<string, unknown>).uploadedDocuments?.length
        : 0,
  });

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const { documents: documentsPayload, ...enrollmentPayload } = payload;

  const parsed = enrollmentSchema.safeParse(enrollmentPayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const documentsValidation = validateEnrollmentDocumentReferences(
    parseEnrollmentDocumentReferences(documentsPayload),
    session.user.id,
  );
  if (!documentsValidation.ok) {
    return NextResponse.json({ error: documentsValidation.error }, { status: 400 });
  }

  const uploadedDocuments =
    Array.isArray(payload.uploadedDocuments) && payload.uploadedDocuments.length > 0
      ? (payload.uploadedDocuments as Array<{
          documentType: string;
          storedPath: string;
          fileName: string;
          mimeType: string;
          size: number;
        }>)
      : [];

  const documents = applyUploadedEnrollmentDocumentMetadata(
    documentsValidation.documents,
    uploadedDocuments.filter(
      (item): item is {
        documentType: (typeof documentsValidation.documents)[number]["type"];
        storedPath: string;
        fileName: string;
        mimeType: string;
        size: number;
      } =>
        typeof item.documentType === "string" &&
        typeof item.storedPath === "string" &&
        typeof item.fileName === "string" &&
        typeof item.mimeType === "string" &&
        typeof item.size === "number",
    ),
  );

  try {
    validateEnrollmentDocumentStorageEnv();
  } catch (error) {
    if (error instanceof EnrollmentDocumentStorageError) {
      return NextResponse.json(
        {
          error:
            "Configurazione storage documenti non disponibile. Contatta la segreteria.",
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: "Errore configurazione storage." }, { status: 500 });
  }

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
    },
  });

  if (!parentProfile) {
    return NextResponse.json(
      { error: "Profilo genitore non trovato. Contatta la segreteria." },
      { status: 404 },
    );
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      let category =
        parsed.data.categoryId === DEFAULT_CATEGORY_ID
          ? null
          : await tx.category.findUnique({
              where: {
                id: parsed.data.categoryId,
              },
              select: {
                id: true,
                seasonLabel: true,
              },
            });

      if (!category) {
        category = await getFallbackCategory(tx);
      }

      const seasonLabel = category.seasonLabel || parsed.data.seasonLabel;

      const athlete = await tx.athlete.create({
        data: {
          firstName: parsed.data.athleteFirstName,
          lastName: parsed.data.athleteLastName,
          gender: parsed.data.athleteGender,
          birthDate: new Date(parsed.data.athleteBirthDate),
          birthPlace: parsed.data.athleteBirthPlace,
          taxCode: parsed.data.athleteTaxCode,
          nationality: parsed.data.athleteNationality,
          address: parsed.data.athleteAddress,
          city: parsed.data.athleteCity,
          postalCode: parsed.data.athletePostalCode,
          province: parsed.data.athleteProvince,
          clothingSize: parsed.data.athleteClothingSize || null,
          medicalNotes: parsed.data.athleteMedicalNotes || null,
          parentId: parentProfile.id,
          categoryId: category.id,
        },
      });

      const enrollment = await tx.enrollment.create({
        data: {
          athleteId: athlete.id,
          categoryId: category.id,
          seasonLabel,
          receiptFirstName: parsed.data.receiptFirstName,
          receiptLastName: parsed.data.receiptLastName,
          receiptTaxCode: parsed.data.receiptTaxCode,
          receiptPhone: parsed.data.receiptPhone,
          receiptAddress: parsed.data.receiptAddress,
          receiptCity: parsed.data.receiptCity,
          receiptPostalCode: parsed.data.receiptPostalCode,
          receiptProvince: parsed.data.receiptProvince,
          receiptEmail: parsed.data.receiptEmail.toLowerCase().trim(),
          privacyConsent: parsed.data.privacyConsent,
          regulationConsent: parsed.data.regulationConsent,
          imageConsent: parsed.data.imageConsent,
          status: "SUBMITTED",
          submittedAt: new Date(),
          notes: parsed.data.enrollmentNotes || null,
        },
      });

      await tx.payment.createMany({
        data: [
          {
            enrollmentId: enrollment.id,
            type: "DEPOSIT",
            amount: new Prisma.Decimal("50.00"),
            dueDate: DEPOSIT_DUE_DATE,
            status: "PENDING",
            notes: "Acconto iscrizione Comun Nuovo Calcio.",
          },
          {
            enrollmentId: enrollment.id,
            type: "BALANCE",
            amount: new Prisma.Decimal("200.00"),
            dueDate: BALANCE_DUE_DATE,
            status: "PENDING",
            notes: "Saldo iscrizione Comun Nuovo Calcio.",
          },
        ],
      });

      await tx.parentProfile.update({
        where: { id: parentProfile.id },
        data: {
          firstName: parsed.data.receiptFirstName,
          lastName: parsed.data.receiptLastName,
          taxCode: parsed.data.receiptTaxCode,
          phone: parsed.data.receiptPhone,
          address: parsed.data.receiptAddress,
          city: parsed.data.receiptCity,
          postalCode: parsed.data.receiptPostalCode,
          province: parsed.data.receiptProvince,
        },
      });

      await tx.enrollmentDocument.createMany({
        data: documents.map((document) => ({
          enrollmentId: enrollment.id,
          type: document.type,
          filePath: document.filePath,
          fileName: document.fileName,
          mimeType: document.mimeType,
          size: document.size > 0 ? document.size : 1,
        })),
      });

      return {
        athleteId: athlete.id,
        enrollmentId: enrollment.id,
      };
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "Anagrafica gia presente. Verifica codice fiscale atleta o dati della ricevuta.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { error: "Errore durante il salvataggio dell'iscrizione." },
      { status: 500 },
    );
  }
}
