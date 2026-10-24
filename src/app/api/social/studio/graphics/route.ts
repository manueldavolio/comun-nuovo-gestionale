import type { SocialGraphicFormat, SocialGraphicStatus, SocialGraphicTemplate } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { decideSocialStudioAccess } from "@/lib/social-studio/access";
import { createSocialGraphic, listSocialGraphics } from "@/lib/social-studio/queries";
import {
  isSocialGraphicFormat,
  isSocialGraphicTemplate,
} from "@/lib/social-studio/templates";

const STATUSES: SocialGraphicStatus[] = ["DRAFT", "EXPORTED", "ARCHIVED"];

export async function GET(request: Request) {
  const session = await getAuthSession();
  const access = decideSocialStudioAccess({
    authenticated: Boolean(session?.user?.id),
    role: session?.user?.role,
  });
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Sessione non valida." : "Operazione non consentita." },
      { status: access.status },
    );
  }

  const { searchParams } = new URL(request.url);
  const statusRaw = searchParams.get("status");
  const status =
    statusRaw && (STATUSES as string[]).includes(statusRaw)
      ? (statusRaw as SocialGraphicStatus)
      : null;

  try {
    const items = await listSocialGraphics({
      q: searchParams.get("q"),
      categoryId: searchParams.get("categoryId"),
      status,
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });
    return NextResponse.json({ success: true, data: { items } });
  } catch (error) {
    console.error("[social studio graphics list]", error);
    return NextResponse.json({ error: "Impossibile caricare l'archivio." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  const access = decideSocialStudioAccess({
    authenticated: Boolean(session?.user?.id),
    role: session?.user?.role,
  });
  if (!access.ok) {
    return NextResponse.json(
      { error: access.status === 401 ? "Sessione non valida." : "Operazione non consentita." },
      { status: access.status },
    );
  }

  let body: { eventId?: unknown; template?: unknown; format?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
  const template =
    typeof body.template === "string" && isSocialGraphicTemplate(body.template)
      ? (body.template as SocialGraphicTemplate)
      : null;
  const format =
    typeof body.format === "string" && isSocialGraphicFormat(body.format)
      ? (body.format as SocialGraphicFormat)
      : null;

  if (!eventId || !template || !format) {
    return NextResponse.json(
      { error: "eventId, template e format sono obbligatori." },
      { status: 400 },
    );
  }

  try {
    const graphic = await createSocialGraphic({
      eventId,
      template,
      format,
      userId: session!.user!.id,
    });
    return NextResponse.json({ success: true, data: graphic }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Creazione non riuscita.";
    console.error("[social studio graphics create]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
