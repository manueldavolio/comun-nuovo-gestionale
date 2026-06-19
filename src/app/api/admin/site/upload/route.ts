import { NextResponse } from "next/server";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import {
  SITE_IMAGE_MAX_BYTES,
  SiteImageStorageError,
  isAllowedSiteImageMime,
  isSiteImageFolder,
  saveSiteImage,
} from "@/lib/site-storage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) {
    return errorResponse;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Richiesta upload non valida." }, { status: 400 });
  }

  const folderValue = formData.get("folder");
  if (typeof folderValue !== "string" || !isSiteImageFolder(folderValue)) {
    return NextResponse.json({ error: "Cartella di destinazione non valida." }, { status: 400 });
  }

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Seleziona almeno un'immagine." }, { status: 400 });
  }

  for (const file of files) {
    if (!isAllowedSiteImageMime(file.type)) {
      return NextResponse.json(
        { error: `Formato non valido per "${file.name}". Sono ammessi JPG, PNG, WEBP, SVG.` },
        { status: 400 },
      );
    }
    if (file.size > SITE_IMAGE_MAX_BYTES) {
      return NextResponse.json(
        { error: `"${file.name}" supera la dimensione massima di 8 MB.` },
        { status: 400 },
      );
    }
  }

  try {
    const uploads = [];
    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const saved = await saveSiteImage({
        folder: folderValue,
        fileBuffer: Buffer.from(arrayBuffer),
        mimeType: file.type,
        originalName: file.name,
      });
      uploads.push({ url: saved.publicUrl, path: saved.path, originalName: file.name });
    }

    return NextResponse.json({ success: true, data: { uploads } }, { status: 201 });
  } catch (error) {
    if (error instanceof SiteImageStorageError) {
      console.error("[site][upload] Storage failure", {
        stage: error.details.stage,
        code: error.details.code,
        missingEnv: error.details.missingEnv,
        bucket: error.details.bucket,
        bucketPath: error.details.bucketPath,
        originalMessage: error.details.originalMessage,
      });
      const isMissingEnv = error.details.code === "SUPABASE_STORAGE_ENV_MISSING";
      return NextResponse.json(
        {
          error: isMissingEnv
            ? `Configurazione mancante: ${error.details.missingEnv ?? "SUPABASE_URL"}.`
            : "Errore durante il salvataggio dell'immagine su Supabase Storage.",
        },
        { status: 500 },
      );
    }

    const message = error instanceof Error ? error.message : "Caricamento immagine non riuscito.";
    console.error("[site][upload] Unexpected upload error", { error });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
