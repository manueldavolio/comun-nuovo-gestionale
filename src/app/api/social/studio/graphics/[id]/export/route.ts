import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { decideSocialStudioAccess } from "@/lib/social-studio/access";
import { updateSocialGraphic } from "@/lib/social-studio/queries";
import { saveSocialStudioImage } from "@/lib/social-studio/storage";

export async function POST(
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
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const updatedAt = String(form.get("updatedAt") ?? "");
  const file = form.get("file");
  if (!updatedAt || !(file instanceof File)) {
    return NextResponse.json(
      { error: "file e updatedAt sono obbligatori." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveSocialStudioImage({
      subfolder: "graphics",
      fileBuffer: buffer,
      mimeType: file.type || "image/png",
      originalName: file.name || "export.png",
    });

    const result = await updateSocialGraphic({
      id,
      userId: session!.user!.id,
      expectedUpdatedAt: updatedAt,
      status: "EXPORTED",
      exportPath: saved.path,
      previewPath: saved.path,
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
      return NextResponse.json({ error: "Export non riuscito." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: { graphic: result.graphic, publicUrl: saved.publicUrl },
    });
  } catch (error) {
    console.error("[social studio export]", error);
    const message = error instanceof Error ? error.message : "Export non riuscito.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
