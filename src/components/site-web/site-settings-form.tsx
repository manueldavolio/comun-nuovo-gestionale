"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { upsertSiteSettingsSchema } from "@/lib/validation/site";

type SiteSettingsFormValues = {
  foundationYear: string;
  teamsCount: string;
  membersCount: string;
  fieldsCount: string;
};

type SiteSettingsFormProps = {
  initialValues: SiteSettingsFormValues;
};

type FieldErrors = Partial<Record<keyof SiteSettingsFormValues, string>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2";

export function SiteSettingsForm({ initialValues }: SiteSettingsFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const parsed = upsertSiteSettingsSchema.safeParse(formData);
    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof SiteSettingsFormValues] = issue.message;
        }
      });
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/site/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita. Riprova.");
        return;
      }

      setSuccess("Impostazioni salvate correttamente.");
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Numeri homepage</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Valori mostrati nella barra statistiche della homepage del sito pubblico.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="foundationYear">
              Anno di fondazione
            </label>
            <input
              id="foundationYear"
              type="number"
              min={1900}
              max={2100}
              value={formData.foundationYear}
              onChange={(event) => setFormData((prev) => ({ ...prev, foundationYear: event.target.value }))}
              className={inputClass}
            />
            <FieldError message={fieldErrors.foundationYear} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="teamsCount">
              Numero squadre
            </label>
            <input
              id="teamsCount"
              value={formData.teamsCount}
              onChange={(event) => setFormData((prev) => ({ ...prev, teamsCount: event.target.value }))}
              placeholder="es. 8"
              className={inputClass}
            />
            <FieldError message={fieldErrors.teamsCount} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="membersCount">
              Numero tesserati
            </label>
            <input
              id="membersCount"
              value={formData.membersCount}
              onChange={(event) => setFormData((prev) => ({ ...prev, membersCount: event.target.value }))}
              placeholder="es. 200+"
              className={inputClass}
            />
            <FieldError message={fieldErrors.membersCount} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="fieldsCount">
              Numero campi
            </label>
            <input
              id="fieldsCount"
              value={formData.fieldsCount}
              onChange={(event) => setFormData((prev) => ({ ...prev, fieldsCount: event.target.value }))}
              placeholder="es. 4"
              className={inputClass}
            />
            <FieldError message={fieldErrors.fieldsCount} />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}
        {success ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Salvataggio..." : "Salva impostazioni"}
        </button>
      </section>
    </form>
  );
}
