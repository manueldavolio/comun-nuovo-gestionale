import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { enrollmentSchema } from "@/lib/validation/enrollment";
import {
  readEnrollmentFilesBuffers,
  validateEnrollmentFilesFromFormData,
} from "@/lib/validation/enrollment-files";
import {
  EnrollmentDocumentStorageError,
  saveEnrollmentDocument,
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

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getFormBoolean(formData: FormData, key: string): boolean {
  const value = formData.get(key);
  return value === "true" || value === "on" || value === "1";
}

function parseEnrollmentPayload(formData: FormData) {
  return {
    athleteFirstName: getFormString(formData, "athleteFirstName"),
    athleteLastName: getFormString(formData, "athleteLastName"),
    athleteGender: getFormString(formData, "athleteGender"),
    athleteBirthDate: getFormString(formData, "athleteBirthDate"),
    athleteBirthPlace: getFormString(formData, "athleteBirthPlace"),
    athleteTaxCode: getFormString(formData, "athleteTaxCode"),
    athleteNationality: getFormString(formData, "athleteNationality"),
    athleteAddress: getFormString(formData, "athleteAddress"),
    athleteCity: getFormString(formData, "athleteCity"),
    athletePostalCode: getFormString(formData, "athletePostalCode"),
    athleteProvince: getFormString(formData, "athleteProvince"),
    athleteClothingSize: getFormString(formData, "athleteClothingSize") || undefined,
    athleteMedicalNotes: getFormString(formData, "athleteMedicalNotes") || undefined,
    receiptFirstName: getFormString(formData, "receiptFirstName"),
    receiptLastName: getFormString(formData, "receiptLastName"),
    receiptTaxCode: getFormString(formData, "receiptTaxCode"),
    receiptPhone: getFormString(formData, "receiptPhone"),
    receiptAddress: getFormString(formData, "receiptAddress"),
    receiptCity: getFormString(formData, "receiptCity"),
    receiptPostalCode: getFormString(formData, "receiptPostalCode"),
    receiptProvince: getFormString(formData, "receiptProvince"),
    receiptEmail: getFormString(formData, "receiptEmail"),
    categoryId: getFormString(formData, "categoryId"),
    seasonLabel: getFormString(formData, "seasonLabel"),
    enrollmentNotes: getFormString(formData, "enrollmentNotes") || undefined,
    privacyConsent: getFormBoolean(formData, "privacyConsent"),
    regulationConsent: getFormBoolean(formData, "regulationConsent"),
    imageConsent: getFormBoolean(formData, "imageConsent"),
  };
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = enrollmentSchema.safeParse(parseEnrollmentPayload(formData));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const filesValidation = validateEnrollmentFilesFromFormData(formData);
  if (!filesValidation.ok) {
    return NextResponse.json({ error: filesValidation.error }, { status: 400 });
  }

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

  let filesWithBuffers;
  try {
    filesWithBuffers = await readEnrollmentFilesBuffers(filesValidation.files);
  } catch {
    return NextResponse.json({ error: "Impossibile leggere i file caricati." }, { status: 400 });
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

      return {
        athleteId: athlete.id,
        enrollmentId: enrollment.id,
      };
    });

    try {
      for (const file of filesWithBuffers) {
        const filePath = await saveEnrollmentDocument({
          enrollmentId: created.enrollmentId,
          documentType: file.type,
          fileBuffer: file.buffer,
          mimeType: file.mimeType,
          originalName: file.fileName,
        });

        await prisma.enrollmentDocument.create({
          data: {
            enrollmentId: created.enrollmentId,
            type: file.type,
            filePath,
            fileName: file.fileName,
            mimeType: file.mimeType,
            size: file.size,
          },
        });
      }
    } catch (uploadError) {
      await prisma.athlete.delete({ where: { id: created.athleteId } }).catch(() => undefined);
      if (uploadError instanceof EnrollmentDocumentStorageError) {
        return NextResponse.json(
          { error: "Caricamento documenti non riuscito. Riprova." },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { error: "Errore durante il salvataggio dei documenti." },
        { status: 500 },
      );
    }

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
