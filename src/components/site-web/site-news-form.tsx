"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageUploadField } from "@/components/site-web/image-upload-field";
import { SITE_NEWS_CATEGORIES } from "@/lib/site-cms";
import { upsertSiteNewsSchema } from "@/lib/validation/site";

type SiteNewsFormValues = {
  title: string;
  subtitle: string;
  content: string;
  coverImageUrl: string;
  category: string;
  published: boolean;
  publishedAt: string;
};

type SiteNewsFormProps = {
  mode: "create" | "edit";
  newsId?: string;
  initialValues: SiteNewsFormValues;
};

type FieldErrors = Partial<Record<keyof SiteNewsFormValues, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2";

export function SiteNewsForm({ mode, newsId, initialValues }: SiteNewsFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = mode === "create" ? "/api/admin/site/news" : `/api/admin/site/news/${newsId}`;
  const method = mode === "create" ? "POST" : "PUT";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = upsertSiteNewsSchema.safeParse(formData);
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof SiteNewsFormValues] = issue.message;
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

      router.push("/admin/sito-web/news");
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
          {mode === "create" ? "Nuova news" : "Modifica news"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Le news pubblicate compaiono nella sezione News del sito pubblico.
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
            <label className="text-sm font-medium text-zinc-700" htmlFor="subtitle">
              Sottotitolo (opzionale)
            </label>
            <input
              id="subtitle"
              value={formData.subtitle}
              onChange={(event) => setFormData((prev) => ({ ...prev, subtitle: event.target.value }))}
              placeholder="Breve riassunto mostrato nelle anteprime"
              className={inputClass}
            />
            <FieldError message={fieldErrors.subtitle} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="content">
              Testo completo
            </label>
            <textarea
              id="content"
              rows={10}
              value={formData.content}
              onChange={(event) => setFormData((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="Scrivi il testo della news. Lascia una riga vuota per separare i paragrafi."
              className={inputClass}
            />
            <FieldError message={fieldErrors.content} />
          </div>

          <ImageUploadField
            label="Immagine copertina (opzionale)"
            folder="news"
            value={formData.coverImageUrl}
            onChange={(url) => setFormData((prev) => ({ ...prev, coverImageUrl: url }))}
          />
          <FieldError message={fieldErrors.coverImageUrl} />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="category">
                Categoria
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(event) => setFormData((prev) => ({ ...prev, category: event.target.value }))}
                className={inputClass}
              >
                {SITE_NEWS_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.category} />
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="publishedAt">
                Data pubblicazione (opzionale)
              </label>
              <input
                id="publishedAt"
                type="date"
                value={formData.publishedAt}
                onChange={(event) => setFormData((prev) => ({ ...prev, publishedAt: event.target.value }))}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-zinc-500">
                Se vuota, viene usata la data di pubblicazione effettiva.
              </p>
              <FieldError message={fieldErrors.publishedAt} />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={formData.published}
              onChange={(event) => setFormData((prev) => ({ ...prev, published: event.target.checked }))}
              className="h-4 w-4 rounded border-zinc-300 text-blue-700 focus:ring-blue-500"
            />
            Pubblicata (se deselezionata resta in bozza, non visibile sul sito)
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
          {isSubmitting ? "Salvataggio..." : mode === "create" ? "Crea news" : "Salva modifiche"}
        </button>
      </section>
    </form>
  );
}
