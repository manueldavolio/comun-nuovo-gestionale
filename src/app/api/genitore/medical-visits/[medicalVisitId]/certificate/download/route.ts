import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  getMedicalVisitCertificateDownloadName,
  MedicalVisitCertificateStorageError,
  readMedicalVisitCertificate,
} from "@/lib/medical-visit-certificates";
import { assertUserParentAssociatedToAthlete } from "@/lib/parent-athletes";
import { prisma } from "@/lib/prisma";
import {
  recordSensitiveDocumentAccess,
  recordSensitiveDocumentAccessRequired,
  SensitiveDocumentAccessLogError,
} from "@/lib/sensitive-document-access-log";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ medicalVisitId: string }>;
};

function detectContentType(fileName: string): string {
  const lowered = fileName.toLowerCase();
  if (lowered.endsWith(".pdf")) return "application/pdf";
  if (lowered.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  const { medicalVisitId } = await context.params;

  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "PARENT") {
    await recordSensitiveDocumentAccess({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "MEDICAL_VISIT_CERTIFICATE",
      resourceId: medicalVisitId || "unknown",
      outcome: "DENIED",
      reason: "Ruolo non PARENT.",
    });
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  if (!medicalVisitId) {
    return NextResponse.json({ error: "Visita medica non valida." }, { status: 400 });
  }

  const medicalVisit = await prisma.medicalVisit.findUnique({
    where: { id: medicalVisitId },
    select: {
      certificateFilePath: true,
      athleteId: true,
    },
  });

  if (!medicalVisit) {
    await recordSensitiveDocumentAccess({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "MEDICAL_VISIT_CERTIFICATE",
      resourceId: medicalVisitId,
      outcome: "DENIED",
      reason: "Visita medica non trovata.",
    });
    return NextResponse.json({ error: "Visita medica non trovata." }, { status: 404 });
  }

  const access = await assertUserParentAssociatedToAthlete({
    userId: session.user.id,
    athleteId: medicalVisit.athleteId,
  });
  if (!access.ok) {
    await recordSensitiveDocumentAccess({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "MEDICAL_VISIT_CERTIFICATE",
      resourceId: medicalVisitId,
      athleteId: medicalVisit.athleteId,
      outcome: "DENIED",
      reason: "Genitore non associato all'atleta (IDOR).",
    });
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  if (!medicalVisit.certificateFilePath) {
    await recordSensitiveDocumentAccess({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "MEDICAL_VISIT_CERTIFICATE",
      resourceId: medicalVisitId,
      athleteId: medicalVisit.athleteId,
      outcome: "DENIED",
      reason: "Certificato non disponibile.",
    });
    return NextResponse.json({ error: "Certificato non disponibile." }, { status: 404 });
  }

  const fileName = getMedicalVisitCertificateDownloadName(medicalVisit.certificateFilePath);

  try {
    const fileBuffer = await readMedicalVisitCertificate(medicalVisit.certificateFilePath);
    await recordSensitiveDocumentAccessRequired({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "MEDICAL_VISIT_CERTIFICATE",
      resourceId: medicalVisitId,
      documentType: "MEDICAL_VISIT_CERTIFICATE",
      athleteId: medicalVisit.athleteId,
      outcome: "ALLOWED",
    });
    const body = new Uint8Array(fileBuffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": detectContentType(fileName),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof SensitiveDocumentAccessLogError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof MedicalVisitCertificateStorageError) {
      await recordSensitiveDocumentAccess({
        userId: session.user.id,
        userRole: session.user.role,
        action: "DOWNLOAD",
        resourceType: "MEDICAL_VISIT_CERTIFICATE",
        resourceId: medicalVisitId,
        athleteId: medicalVisit.athleteId,
        outcome: "DENIED",
        reason: error.details.code ?? error.message,
      });
      if (error.details.code === "SUPABASE_STORAGE_ENV_MISSING") {
        return NextResponse.json(
          {
            error:
              "Configurazione Supabase Storage mancante. Impostare SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_MEDICAL_VISITS_BUCKET.",
          },
          { status: 500 },
        );
      }
      if (error.details.code === "CERTIFICATE_NOT_FOUND") {
        return NextResponse.json({ error: "Certificato non disponibile." }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Impossibile leggere il certificato." }, { status: 500 });
  }
}
