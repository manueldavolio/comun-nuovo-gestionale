import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getCurrentLegalDocument } from "@/lib/legal/legal-documents";
import {
  acknowledgeCurrentPrivacyNotice,
  getLatestPrivacyNoticeAcknowledgement,
} from "@/lib/legal/privacy-acknowledgement";

export const runtime = "nodejs";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const current = await getCurrentLegalDocument("PRIVACY_NOTICE");
  const latest = await getLatestPrivacyNoticeAcknowledgement(session.user.id);
  const acknowledgedCurrent =
    Boolean(current) &&
    latest?.documentVersion === current?.version &&
    latest?.documentContentSha256 === current?.contentSha256;

  return NextResponse.json({
    currentDocument: current
      ? {
          version: current.version,
          title: current.title,
          bodyText: current.bodyText,
          contentSha256: current.contentSha256,
          effectiveFrom: current.effectiveFrom,
        }
      : null,
    latestAcknowledgement: latest,
    acknowledgedCurrent,
  });
}

export async function POST() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  try {
    const ack = await acknowledgeCurrentPrivacyNotice({
      userId: session.user.id,
      source: "parent_area",
    });
    return NextResponse.json({
      success: true,
      acknowledgement: ack,
      note: "Presa visione registrata. Non costituisce consenso alle autorizzazioni immagini.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PRIVACY_NOTICE_DOCUMENT_MISSING") {
      return NextResponse.json(
        { error: "Informativa privacy non configurata. Contatta la segreteria." },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Impossibile registrare la presa visione." }, { status: 500 });
  }
}
