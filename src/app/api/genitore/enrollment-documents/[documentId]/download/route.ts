import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  EnrollmentDocumentStorageError,
  getEnrollmentDocumentDownloadName,
  readEnrollmentDocument,
} from "@/lib/enrollment-documents";
import { prisma } from "@/lib/prisma";

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
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { documentId } = await context.params;
  if (!documentId) {
    return NextResponse.json({ error: "Documento non valido." }, { status: 400 });
  }

  const document = await prisma.enrollmentDocument.findUnique({
    where: { id: documentId },
    select: {
      filePath: true,
      fileName: true,
      mimeType: true,
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
  });

  if (!document) {
    return NextResponse.json({ error: "Documento non trovato." }, { status: 404 });
  }

  if (document.enrollment.athlete.parent.userId !== session.user.id) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const fileName = getEnrollmentDocumentDownloadName(document.filePath, document.fileName);

  try {
    const fileBuffer = await readEnrollmentDocument(document.filePath);
    const body = new Uint8Array(fileBuffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": detectContentType(fileName, document.mimeType),
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof EnrollmentDocumentStorageError) {
      if (error.details.code === "SUPABASE_STORAGE_ENV_MISSING") {
        return NextResponse.json(
          {
            error:
              "Configurazione Supabase Storage mancante. Impostare SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SUPABASE_ENROLLMENT_DOCUMENTS_BUCKET.",
          },
          { status: 500 },
        );
      }
      if (error.details.code === "DOCUMENT_NOT_FOUND") {
        return NextResponse.json({ error: "Documento non disponibile." }, { status: 404 });
      }
    }

    return NextResponse.json({ error: "Impossibile leggere il documento." }, { status: 500 });
  }
}
