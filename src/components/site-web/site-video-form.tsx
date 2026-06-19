"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { extractYoutubeId } from "@/lib/site-cms";
import { upsertSiteVideoSchema } from "@/lib/validation/site";

type SiteVideoFormValues = {
  title: string;
  youtubeUrl: string;
  description: string;
  isVisible: boolean;
};

type SiteVideoFormProps = {
  mode: "create" | "edit";
  videoId?: string;
  initialValues: SiteVideoFormValues;
};

type FieldErrors = Partial<Record<keyof SiteVideoFormValues, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2";

export function SiteVideoForm({ mode, videoId, initialValues }: SiteVideoFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = mode === "create" ? "/api/admin/site/videos" : `/api/admin/site/videos/${videoId}`;
  const method = mode === "create" ? "POST" : "PUT";

  const previewId = extractYoutubeId(formData.youtubeUrl);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = upsertSiteVideoSchema.safeParse(formData);
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof SiteVideoFormValues] = issue.message;
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

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita. Riprova.");
        setIsSubmitting(false);
        return;
      }

      router.push("/admin/sito-web/video");
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
          {mode === "create" ? "Nuovo video" : "Modifica video"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          I video visibili compaiono nella pagina Media del sito pubblico.
        </p>

        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="title">
              Titolo
            </label>
            <input
              id="title"
              value={formData.title}
              onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
              className={inputClass}
            />
            <FieldError message={fieldErrors.title} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="youtubeUrl">
              Link YouTube
            </label>
            <input
              id="youtubeUrl"
              value={formData.youtubeUrl}
              onChange={(event) => setFormData((prev) => ({ ...prev, youtubeUrl: event.target.value }))}
              placeholder="https://www.youtube.com/watch?v=..."
              className={inputClass}
            />
            <FieldError message={fieldErrors.youtubeUrl} />
          </div>

          {previewId ? (
            <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- anteprima admin */}
              <img
                src={`https://img.youtube.com/vi/${previewId}/mqdefault.jpg`}
                alt="Anteprima video YouTube"
                className="h-16 w-28 rounded-md border border-zinc-200 object-cover"
              />
              <p className="text-xs text-zinc-600">
                Video riconosciuto: <span className="font-mono font-semibold">{previewId}</span>
              </p>
            </div>
          ) : null}

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="description">
              Descrizione (opzionale)
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
              className={inputClass}
            />
            <FieldError message={fieldErrors.description} />
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
          {isSubmitting ? "Salvataggio..." : mode === "create" ? "Crea video" : "Salva modifiche"}
        </button>
      </section>
    </form>
  );
}
