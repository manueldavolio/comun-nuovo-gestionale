import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  getMedicalVisitCertificateDownloadName,
  MedicalVisitCertificateStorageError,
  readMedicalVisitCertificate,
} from "@/lib/medical-visit-certificates";
import { prisma } from "@/lib/prisma";
import {
  recordSensitiveDocumentAccess,
  recordSensitiveDocumentAccessRequired,
  SensitiveDocumentAccessLogError,
} from "@/lib/sensitive-document-access-log";
import { assertCanAccessMedicalVisitData } from "@/lib/youth-director-data-access";

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

  if (session.user.role !== "ADMIN") {
    await recordSensitiveDocumentAccess({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "MEDICAL_VISIT_CERTIFICATE",
      resourceId: medicalVisitId || "unknown",
      outcome: "DENIED",
      reason: "Ruolo non ADMIN.",
    });
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  if (!medicalVisitId) {
    return NextResponse.json({ error: "Visita medica non valida." }, { status: 400 });
  }

  const visitAccess = await assertCanAccessMedicalVisitData({
    userId: session.user.id,
    role: session.user.role,
    medicalVisitId,
  });
  if (!visitAccess.ok) {
    await recordSensitiveDocumentAccess({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "MEDICAL_VISIT_CERTIFICATE",
      resourceId: medicalVisitId,
      outcome: "DENIED",
      reason: visitAccess.error,
    });
    return NextResponse.json({ error: visitAccess.error }, { status: visitAccess.status });
  }

  const medicalVisit = await prisma.medicalVisit.findUnique({
    where: { id: medicalVisitId },
    select: { certificateFilePath: true, athleteId: true },
  });

  if (!medicalVisit) {
    await recordSensitiveDocumentAccess({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "MEDICAL_VISIT_CERTIFICATE",
      resourceId: medicalVisitId,
      athleteId: visitAccess.athleteId,
      outcome: "DENIED",
      reason: "Visita medica non trovata.",
    });
    return NextResponse.json({ error: "Visita medica non trovata." }, { status: 404 });
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
      console.error("[medical-visits][admin-download-certificate] Read failure", {
        errorName: error.name,
        stage: error.details.stage,
        code: error.details.code,
        userId: session.user.id,
        medicalVisitId,
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
