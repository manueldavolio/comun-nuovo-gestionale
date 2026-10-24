import type { SocialAssetKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { decideSocialStudioAccess } from "@/lib/social-studio/access";
import { createSocialAsset, listSocialAssets } from "@/lib/social-studio/queries";
import { saveSocialStudioImage } from "@/lib/social-studio/storage";

const KINDS: SocialAssetKind[] = ["OPPONENT_LOGO", "BACKGROUND", "CLUB_LOGO"];

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

  const kindRaw = new URL(request.url).searchParams.get("kind");
  const kind =
    kindRaw && (KINDS as string[]).includes(kindRaw)
      ? (kindRaw as SocialAssetKind)
      : null;

  try {
    const assets = await listSocialAssets(kind);
    return NextResponse.json({ success: true, data: { assets } });
  } catch (error) {
    console.error("[social studio assets list]", error);
    return NextResponse.json({ error: "Impossibile caricare gli asset." }, { status: 500 });
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

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const kindRaw = String(form.get("kind") ?? "");
  const label = String(form.get("label") ?? "").trim();
  const file = form.get("file");
  if (!(KINDS as string[]).includes(kindRaw) || !label || !(file instanceof File)) {
    return NextResponse.json(
      { error: "kind, label e file sono obbligatori." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveSocialStudioImage({
      subfolder: "assets",
      fileBuffer: buffer,
      mimeType: file.type || "image/png",
      originalName: file.name,
    });
    const asset = await createSocialAsset({
      kind: kindRaw as SocialAssetKind,
      label,
      storagePath: saved.path,
      publicUrl: saved.publicUrl,
      userId: session!.user!.id,
    });
    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (error) {
    console.error("[social studio assets create]", error);
    const message = error instanceof Error ? error.message : "Upload non riuscito.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
