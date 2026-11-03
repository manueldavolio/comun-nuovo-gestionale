import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { decideStaffEnrollmentIdentityDocumentDownload } from "@/lib/enrollment-document-access-policy";
import {
  EnrollmentDocumentStorageError,
  getEnrollmentDocumentDownloadName,
  readEnrollmentDocument,
} from "@/lib/enrollment-documents";
import { prisma } from "@/lib/prisma";
import {
  recordSensitiveDocumentAccess,
  recordSensitiveDocumentAccessRequired,
  SensitiveDocumentAccessLogError,
} from "@/lib/sensitive-document-access-log";
import { assertCanAccessEnrollmentDocumentData } from "@/lib/youth-director-data-access";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ documentId: string }>;
};

function detectContentType(fileName: string, mimeType: string): string {
  if (mimeType) {
    return mimeType;
  }

  const lowered = fileName.toLowerCase();
  if (lowered.endsWith(".pdf")) return "application/pdf";
  if (lowered.endsWith(".png")) return "image/png";
  return "image/jpeg";
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthSession();
  const { documentId } = await context.params;

  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const staffDecision = decideStaffEnrollmentIdentityDocumentDownload({
    authenticated: true,
    role: session.user.role,
  });
  if (!staffDecision.allow) {
    await recordSensitiveDocumentAccess({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "ENROLLMENT_DOCUMENT",
      resourceId: documentId || "unknown",
      outcome: "DENIED",
      reason: staffDecision.error,
    });
    return NextResponse.json(
      { error: staffDecision.error },
      { status: staffDecision.status },
    );
  }

  if (!documentId) {
    return NextResponse.json({ error: "Documento non valido." }, { status: 400 });
  }

  const enrollmentAccess = await assertCanAccessEnrollmentDocumentData({
    userId: session.user.id,
    role: session.user.role,
    documentId,
  });
  if (!enrollmentAccess.ok) {
    await recordSensitiveDocumentAccess({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "ENROLLMENT_DOCUMENT",
      resourceId: documentId,
      outcome: "DENIED",
      reason: enrollmentAccess.error,
    });
    return NextResponse.json(
      { error: enrollmentAccess.error },
      { status: enrollmentAccess.status },
    );
  }

  const document = await prisma.enrollmentDocument.findUnique({
    where: { id: documentId },
    select: {
      filePath: true,
      fileName: true,
      mimeType: true,
      type: true,
    },
  });

  if (!document) {
    await recordSensitiveDocumentAccess({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "ENROLLMENT_DOCUMENT",
      resourceId: documentId,
      athleteId: enrollmentAccess.athleteId,
      outcome: "DENIED",
      reason: "Documento non trovato.",
    });
    return NextResponse.json({ error: "Documento non trovato." }, { status: 404 });
  }

  const fileName = getEnrollmentDocumentDownloadName(document.filePath, document.fileName);

  try {
    const fileBuffer = await readEnrollmentDocument(document.filePath);
    // Fail-closed: nessun download ALLOWED senza riga di audit.
    await recordSensitiveDocumentAccessRequired({
      userId: session.user.id,
      userRole: session.user.role,
      action: "DOWNLOAD",
      resourceType: "ENROLLMENT_DOCUMENT",
      resourceId: documentId,
      documentType: document.type,
      athleteId: enrollmentAccess.athleteId,
      outcome: "ALLOWED",
    });
    const body = new Uint8Array(fileBuffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": detectContentType(fileName, document.mimeType),
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof SensitiveDocumentAccessLogError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    if (error instanceof EnrollmentDocumentStorageError) {
      await recordSensitiveDocumentAccess({
        userId: session.user.id,
        userRole: session.user.role,
        action: "DOWNLOAD",
        resourceType: "ENROLLMENT_DOCUMENT",
        resourceId: documentId,
        documentType: document.type,
        athleteId: enrollmentAccess.athleteId,
        outcome: "DENIED",
        reason: error.details.code ?? error.message,
      });
      if (error.details.code === "SUPABASE_STORAGE_ENV_MISSING") {
        return NextResponse.json(
          {
            error:
              "Configurazione Supabase Storage mancante. Impostare SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ENROLLMENT_DOCUMENTS_BUCKET.",
          },
          { status: 500 },
        );
      }
      if (
        error.details.code === "DOCUMENT_NOT_FOUND" ||
        error.details.code?.startsWith("INVALID_DOCUMENT_PATH_")
      ) {
        return NextResponse.json({ error: "Documento non disponibile." }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Impossibile leggere il documento." }, { status: 500 });
  }
}
