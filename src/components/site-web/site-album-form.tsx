"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { upsertSiteGalleryAlbumSchema } from "@/lib/validation/site";

type SiteAlbumFormValues = {
  title: string;
  date: string;
  isVisible: boolean;
};

type SiteAlbumFormProps = {
  mode: "create" | "edit";
  albumId?: string;
  initialValues: SiteAlbumFormValues;
};

type FieldErrors = Partial<Record<keyof SiteAlbumFormValues, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2";

export function SiteAlbumForm({ mode, albumId, initialValues }: SiteAlbumFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = mode === "create" ? "/api/admin/site/gallery" : `/api/admin/site/gallery/${albumId}`;
  const method = mode === "create" ? "POST" : "PUT";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = upsertSiteGalleryAlbumSchema.safeParse(formData);
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof SiteAlbumFormValues] = issue.message;
        }
      });
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => null)) as
        | { error?: string; data?: { id?: string } }
        | null;
      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita. Riprova.");
        setIsSubmitting(false);
        return;
      }

      if (mode === "create" && body?.data?.id) {
        // Dopo la creazione si passa alla modifica per caricare le foto.
        router.push(`/admin/sito-web/galleria/${body.data.id}/modifica`);
      } else {
        router.push("/admin/sito-web/galleria");
      }
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          {mode === "create" ? "Nuovo album" : "Dati album"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          {mode === "create"
            ? "Crea l'album: dopo il salvataggio potrai caricare le foto."
            : "Titolo, data e visibilità dell'album."}
        </p>

        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="title">
              Titolo album
            </label>
            <input
              id="title"
              value={formData.title}
              onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="es. Festa di fine stagione 2026"
              className={inputClass}
            />
            <FieldError message={fieldErrors.title} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="date">
              Data (opzionale)
            </label>
            <input
              id="date"
              type="date"
              value={formData.date}
              onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
              className={inputClass}
            />
            <FieldError message={fieldErrors.date} />
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={formData.isVisible}
              onChange={(event) => setFormData((prev) => ({ ...prev, isVisible: event.target.checked }))}
              className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
            />
            Visibile sul sito pubblico
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Salvataggio..." : mode === "create" ? "Crea album" : "Salva modifiche"}
        </button>
      </section>
    </form>
  );
}
