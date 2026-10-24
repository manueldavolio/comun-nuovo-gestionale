import type { SocialGraphicFormat, SocialGraphicStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { decideSocialStudioAccess } from "@/lib/social-studio/access";
import { parseOverrides } from "@/lib/social-studio/dto";
import { getSocialGraphic, updateSocialGraphic } from "@/lib/social-studio/queries";
import { isSocialGraphicFormat } from "@/lib/social-studio/templates";

const STATUSES: SocialGraphicStatus[] = ["DRAFT", "EXPORTED", "ARCHIVED"];

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id } = await context.params;
  try {
    const graphic = await getSocialGraphic(id);
    if (!graphic) {
      return NextResponse.json({ error: "Grafica non trovata." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: graphic });
  } catch (error) {
    console.error("[social studio graphic get]", error);
    return NextResponse.json({ error: "Impossibile caricare la grafica." }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const expectedUpdatedAt =
    typeof body.updatedAt === "string" ? body.updatedAt : "";
  if (!expectedUpdatedAt) {
    return NextResponse.json(
      { error: "updatedAt obbligatorio per evitare sovrascritture." },
      { status: 400 },
    );
  }

  const status =
    typeof body.status === "string" && (STATUSES as string[]).includes(body.status)
      ? (body.status as SocialGraphicStatus)
      : undefined;
  const format =
    typeof body.format === "string" && isSocialGraphicFormat(body.format)
      ? (body.format as SocialGraphicFormat)
      : undefined;
  const title = typeof body.title === "string" ? body.title : undefined;
  const overrides =
    body.overrides !== undefined ? parseOverrides(body.overrides) : undefined;

  try {
    const result = await updateSocialGraphic({
      id,
      userId: session!.user!.id,
      expectedUpdatedAt,
      title,
      status,
      format,
      overrides,
      previewPath: typeof body.previewPath === "string" || body.previewPath === null ? (body.previewPath as string | null) : undefined,
      exportPath: typeof body.exportPath === "string" || body.exportPath === null ? (body.exportPath as string | null) : undefined,
    });

    if (!result.ok && result.reason === "notFound") {
      return NextResponse.json({ error: "Grafica non trovata." }, { status: 404 });
    }
    if (!result.ok && result.reason === "conflict") {
      return NextResponse.json(
        {
          error: "La bozza è stata modificata da un altro utente. Ricarica e riprova.",
          data: result.graphic,
        },
        { status: 409 },
      );
    }
    if (!result.ok) {
      return NextResponse.json({ error: "Salvataggio non riuscito." }, { status: 500 });
    }
    return NextResponse.json({ success: true, data: result.graphic });
  } catch (error) {
    console.error("[social studio graphic patch]", error);
    return NextResponse.json({ error: "Salvataggio non riuscito." }, { status: 500 });
  }
}
