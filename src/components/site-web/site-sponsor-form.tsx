"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ImageUploadField } from "@/components/site-web/image-upload-field";
import {
  SITE_SPONSOR_CATEGORY_LABELS,
  type SiteSponsorCategoryValue,
} from "@/lib/site-cms";
import { upsertSiteSponsorSchema } from "@/lib/validation/site";

type SiteSponsorFormValues = {
  name: string;
  category: SiteSponsorCategoryValue;
  logoUrl: string;
  websiteUrl: string;
  isVisible: boolean;
};

type SiteSponsorFormProps = {
  mode: "create" | "edit";
  sponsorId?: string;
  initialValues: SiteSponsorFormValues;
};

type FieldErrors = Partial<Record<keyof SiteSponsorFormValues, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2";

export function SiteSponsorForm({ mode, sponsorId, initialValues }: SiteSponsorFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = mode === "create" ? "/api/admin/site/sponsors" : `/api/admin/site/sponsors/${sponsorId}`;
  const method = mode === "create" ? "POST" : "PUT";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = upsertSiteSponsorSchema.safeParse(formData);
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof SiteSponsorFormValues] = issue.message;
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

      router.push("/admin/sito-web/sponsor");
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
          {mode === "create" ? "Nuovo sponsor" : "Modifica sponsor"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Gli sponsor visibili compaiono nella pagina Sponsor del sito pubblico.
        </p>

        <div className="mt-4 grid gap-4">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="name">
              Nome sponsor
            </label>
            <input
              id="name"
              value={formData.name}
              onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
              className={inputClass}
            />
            <FieldError message={fieldErrors.name} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="category">
                Categoria sponsor
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(event) =>
                  setFormData((prev) => ({
                    ...prev,
                    category: event.target.value as SiteSponsorCategoryValue,
                  }))
                }
                className={inputClass}
              >
                {Object.entries(SITE_SPONSOR_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <FieldError message={fieldErrors.category} />
            </div>

            <div>
              <label className="text-sm font-medium text-zinc-700" htmlFor="websiteUrl">
                Link sito (opzionale)
              </label>
              <input
                id="websiteUrl"
                value={formData.websiteUrl}
                onChange={(event) => setFormData((prev) => ({ ...prev, websiteUrl: event.target.value }))}
                placeholder="https://..."
                className={inputClass}
              />
              <FieldError message={fieldErrors.websiteUrl} />
            </div>
          </div>

          <ImageUploadField
            label="Logo (opzionale)"
            folder="sponsors"
            value={formData.logoUrl}
            onChange={(url) => setFormData((prev) => ({ ...prev, logoUrl: url }))}
          />
          <FieldError message={fieldErrors.logoUrl} />

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
          {isSubmitting ? "Salvataggio..." : mode === "create" ? "Crea sponsor" : "Salva modifiche"}
        </button>
      </section>
    </form>
  );
}
