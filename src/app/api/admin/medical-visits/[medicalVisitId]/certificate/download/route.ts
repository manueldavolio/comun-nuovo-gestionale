import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  getMedicalVisitCertificateDownloadName,
  readMedicalVisitCertificate,
} from "@/lib/medical-visit-certificates";
import { prisma } from "@/lib/prisma";

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
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { medicalVisitId } = await context.params;
  if (!medicalVisitId) {
    return NextResponse.json({ error: "Visita medica non valida." }, { status: 400 });
  }

  const medicalVisit = await prisma.medicalVisit.findUnique({
    where: { id: medicalVisitId },
    select: { certificateFilePath: true },
  });

  if (!medicalVisit) {
    return NextResponse.json({ error: "Visita medica non trovata." }, { status: 404 });
  }

  if (!medicalVisit.certificateFilePath) {
    return NextResponse.json({ error: "Certificato non disponibile." }, { status: 404 });
  }

  const fileName = getMedicalVisitCertificateDownloadName(medicalVisit.certificateFilePath);

  try {
    const fileBuffer = await readMedicalVisitCertificate(medicalVisit.certificateFilePath);
    const body = new Uint8Array(fileBuffer);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": detectContentType(fileName),
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Impossibile leggere il certificato." }, { status: 500 });
  }
}
