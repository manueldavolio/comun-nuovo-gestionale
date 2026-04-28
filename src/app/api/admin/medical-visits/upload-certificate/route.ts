import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  MEDICAL_VISIT_CERTIFICATE_MAX_BYTES,
  isAllowedMedicalVisitCertificateMime,
  saveMedicalVisitCertificate,
} from "@/lib/medical-visit-certificates";

export const runtime = "nodejs";

const GENERIC_UPLOAD_ERROR = "Caricamento certificato non riuscito.";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Richiesta upload non valida." }, { status: 400 });
  }

  const file = formData.get("certificate");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Seleziona un file certificato." }, { status: 400 });
  }

  if (!isAllowedMedicalVisitCertificateMime(file.type)) {
    return NextResponse.json(
      { error: "Formato non valido. Sono ammessi PDF, JPG, PNG." },
      { status: 400 },
    );
  }

  if (file.size > MEDICAL_VISIT_CERTIFICATE_MAX_BYTES) {
    return NextResponse.json({ error: "Il file supera la dimensione massima di 10 MB." }, { status: 400 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const storedPath = await saveMedicalVisitCertificate({
      fileBuffer: Buffer.from(arrayBuffer),
      mimeType: file.type,
      originalName: file.name,
    });

    return NextResponse.json({ success: true, data: { storedPath, originalName: file.name } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: GENERIC_UPLOAD_ERROR }, { status: 500 });
  }
}
