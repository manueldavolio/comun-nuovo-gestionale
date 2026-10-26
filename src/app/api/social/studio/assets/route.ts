import type { SocialAssetKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { SiteImageStorageError } from "@/lib/site-storage";
import { decideSocialStudioAccess } from "@/lib/social-studio/access";
import {
  createSocialAsset,
  findOpponentAssetByName,
  linkOpponentAlias,
  listSocialAssets,
  replaceSocialAsset,
} from "@/lib/social-studio/queries";
import {
  describeSocialStudioUploadError,
  saveSocialStudioImage,
} from "@/lib/social-studio/storage";

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

  const url = new URL(request.url);
  const kindRaw = url.searchParams.get("kind");
  const kind =
    kindRaw && (KINDS as string[]).includes(kindRaw)
      ? (kindRaw as SocialAssetKind)
      : null;
  const suggest = (url.searchParams.get("suggest") ?? "").trim();

  try {
    const assets = await listSocialAssets(kind);
    if (suggest) {
      const { matchOpponentAsset } = await import("@/lib/social-studio/opponent-key");
      const match = matchOpponentAsset(
        suggest,
        assets.filter((a) => a.kind === "OPPONENT_LOGO"),
      );
      return NextResponse.json({
        success: true,
        data: {
          assets,
          suggestion:
            match.kind === "none"
              ? null
              : {
                  kind: match.kind,
                  asset: match.asset,
                  distance: "distance" in match ? match.distance : 0,
                  autoApply: match.kind === "exact",
                },
        },
      });
    }
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

  const contentType = request.headers.get("content-type") ?? "";

  // Alias verificato (JSON): collega un nome calendario a uno stemma esistente.
  if (contentType.includes("application/json")) {
    let body: {
      action?: unknown;
      sourceAssetId?: unknown;
      aliasLabel?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
    }
    if (body.action !== "alias") {
      return NextResponse.json({ error: "Azione non supportata." }, { status: 400 });
    }
    const sourceAssetId =
      typeof body.sourceAssetId === "string" ? body.sourceAssetId.trim() : "";
    const aliasLabel = typeof body.aliasLabel === "string" ? body.aliasLabel.trim() : "";
    if (!sourceAssetId || !aliasLabel) {
      return NextResponse.json(
        { error: "sourceAssetId e aliasLabel sono obbligatori." },
        { status: 400 },
      );
    }
    try {
      const asset = await linkOpponentAlias({
        sourceAssetId,
        aliasLabel,
        userId: session!.user!.id,
      });
      return NextResponse.json({ success: true, data: asset, aliased: true }, { status: 201 });
    } catch (error) {
      console.error("[social studio assets alias]", error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Impossibile creare l'alias.",
        },
        { status: 400 },
      );
    }
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const kindRaw = String(form.get("kind") ?? "");
  const label = String(form.get("label") ?? "").trim();
  const replace = String(form.get("replace") ?? "") === "true";
  const file = form.get("file");
  if (!(KINDS as string[]).includes(kindRaw) || !label || !(file instanceof File)) {
    return NextResponse.json(
      { error: "kind, label e file sono obbligatori." },
      { status: 400 },
    );
  }

  try {
    if (kindRaw === "OPPONENT_LOGO" && !replace) {
      const existing = await findOpponentAssetByName(label);
      if (existing) {
        return NextResponse.json(
          {
            error: "Stemma già presente per questa squadra. Conferma per sostituirlo.",
            code: "ASSET_EXISTS",
            existing,
          },
          { status: 409 },
        );
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveSocialStudioImage({
      subfolder: "assets",
      fileBuffer: buffer,
      mimeType: file.type || "image/png",
      originalName: file.name,
    });

    if (kindRaw === "OPPONENT_LOGO" && replace) {
      const existing = await findOpponentAssetByName(label);
      if (existing) {
        // Nuovo path storage: i file precedenti restano online così le
        // grafiche storiche che salvano il vecchio publicUrl non cambiano.
        const asset = await replaceSocialAsset({
          id: existing.id,
          label,
          storagePath: saved.path,
          publicUrl: saved.publicUrl,
        });
        return NextResponse.json({ success: true, data: asset, replaced: true });
      }
    }

    const asset = await createSocialAsset({
      kind: kindRaw as SocialAssetKind,
      label,
      storagePath: saved.path,
      publicUrl: saved.publicUrl,
      userId: session!.user!.id,
    });
    return NextResponse.json({ success: true, data: asset }, { status: 201 });
  } catch (error) {
    if (error instanceof SiteImageStorageError) {
      console.error("[social studio assets create] Storage failure", {
        stage: error.details.stage,
        code: error.details.code,
        bucket: error.details.bucket,
        bucketPath: error.details.bucketPath,
        originalMessage: error.details.originalMessage,
      });
    } else {
      console.error("[social studio assets create]", error);
    }
    const described = describeSocialStudioUploadError(error);
    return NextResponse.json({ error: described.message }, { status: described.status });
  }
}
