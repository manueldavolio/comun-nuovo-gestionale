"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";

type AlbumImage = {
  id: string;
  imageUrl: string;
  alt: string | null;
};

type SiteAlbumImagesManagerProps = {
  albumId: string;
  images: AlbumImage[];
};

type UploadResponse = {
  success?: boolean;
  error?: string;
  data?: { uploads?: { url: string; originalName?: string }[] };
};

/** Upload multiplo immagini di un album galleria + eliminazione singola. */
export function SiteAlbumImagesManager({ albumId, images }: SiteAlbumImagesManagerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("folder", "gallery");
      files.forEach((file) => formData.append("files", file));

      const uploadResponse = await fetch("/api/admin/site/upload", {
        method: "POST",
        body: formData,
      });
      const uploadBody = (await uploadResponse.json().catch(() => null)) as UploadResponse | null;

      if (!uploadResponse.ok || !uploadBody?.data?.uploads?.length) {
        setError(uploadBody?.error ?? "Caricamento immagini non riuscito.");
        return;
      }

      const saveResponse = await fetch(`/api/admin/site/gallery/${albumId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: uploadBody.data.uploads.map((upload) => ({
            imageUrl: upload.url,
            alt: upload.originalName ?? null,
          })),
        }),
      });
      const saveBody = (await saveResponse.json().catch(() => null)) as { error?: string } | null;

      if (!saveResponse.ok) {
        setError(saveBody?.error ?? "Salvataggio immagini non riuscito.");
        return;
      }

      setSuccess(`${uploadBody.data.uploads.length} immagine/i caricate.`);
      router.refresh();
    } catch {
      setError("Errore imprevisto durante il caricamento.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  async function onDeleteImage(imageId: string) {
    if (!window.confirm("Eliminare questa immagine dall'album?")) {
      return;
    }

    setError(null);
    setSuccess(null);
    setDeletingId(imageId);

    try {
      const response = await fetch(`/api/admin/site/gallery/images/${imageId}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(body?.error ?? "Eliminazione non riuscita.");
        return;
      }

      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Foto dell&apos;album</h2>
          <p className="mt-1 text-sm text-zinc-600">
            {images.length} foto — puoi selezionare più file in una volta.
          </p>
        </div>

        <label className="inline-flex w-fit cursor-pointer items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800">
          {isUploading ? "Caricamento..." : "Carica foto"}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={isUploading}
            onChange={onFilesSelected}
          />
        </label>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {success ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      ) : null}

      {images.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm text-zinc-500">
          Nessuna foto nell&apos;album. Usa &quot;Carica foto&quot; per aggiungerne.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image) => (
            <li key={image.id} className="group relative overflow-hidden rounded-lg border border-zinc-200">
              {/* eslint-disable-next-line @next/next/no-img-element -- anteprima admin */}
              <img
                src={image.imageUrl}
                alt={image.alt ?? "Foto album"}
                className="aspect-square w-full object-cover"
              />
              <button
                type="button"
                onClick={() => onDeleteImage(image.id)}
                disabled={deletingId === image.id}
                className="absolute right-1.5 top-1.5 rounded-md border border-red-200 bg-white/95 px-2 py-1 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:opacity-60"
              >
                {deletingId === image.id ? "..." : "Elimina"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
