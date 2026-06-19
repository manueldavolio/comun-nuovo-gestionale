"use client";

import { useRef, useState, type ChangeEvent } from "react";

type ImageUploadFieldProps = {
  label: string;
  folder: "players" | "staff" | "news" | "sponsors" | "gallery";
  value: string;
  onChange: (url: string) => void;
  helperText?: string;
};

type UploadResponse = {
  success?: boolean;
  error?: string;
  data?: { uploads?: { url: string }[] };
};

/** Campo upload immagine singola su Supabase Storage con anteprima. */
export function ImageUploadField({ label, folder, value, onChange, helperText }: ImageUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("folder", folder);
      formData.append("files", file);

      const response = await fetch("/api/admin/site/upload", {
        method: "POST",
        body: formData,
      });
      const body = (await response.json().catch(() => null)) as UploadResponse | null;

      if (!response.ok || !body?.data?.uploads?.[0]?.url) {
        setError(body?.error ?? "Caricamento immagine non riuscito.");
        return;
      }

      onChange(body.data.uploads[0].url);
    } catch {
      setError("Errore imprevisto durante il caricamento.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div>
      <p className="text-sm font-medium text-zinc-700">{label}</p>

      <div className="mt-1 flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- anteprima admin, URL esterno Supabase
          <img
            src={value}
            alt="Anteprima immagine"
            className="h-20 w-20 shrink-0 rounded-lg border border-zinc-200 bg-white object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Nessuna foto
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
              {isUploading ? "Caricamento..." : value ? "Sostituisci immagine" : "Carica immagine"}
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                className="hidden"
                disabled={isUploading}
                onChange={onFileSelected}
              />
            </label>

            {value ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                Rimuovi
              </button>
            ) : null}
          </div>

          <p className="text-xs text-zinc-500">
            {helperText ?? "JPG, PNG, WEBP o SVG — max 8 MB."}
          </p>
        </div>
      </div>

      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
