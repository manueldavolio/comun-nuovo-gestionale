"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { DocumentType } from "@prisma/client";
import { upsertDocumentSchema, type UpsertDocumentInput } from "@/lib/validation/documents";
import { DOCUMENT_TYPE_CHOICES } from "@/lib/document-types";

type AthleteOption = {
  id: string;
  fullName: string;
};

type DocumentFormProps = {
  mode: "create" | "edit";
  documentId?: string;
  athletes: AthleteOption[];
  initialValues: {
    athleteId: string;
    type: DocumentType;
    title: string;
    expiryDate: string; // YYYY-MM-DD or empty string
    notes: string;
    filePath: string;
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-red-600">{message}</p>;
}

type DocumentFieldErrors = Partial<Record<keyof UpsertDocumentInput, string>>;

export function DocumentForm({ mode, documentId, athletes, initialValues }: DocumentFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<DocumentFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = mode === "create" ? "/api/admin/documents" : `/api/admin/documents/${documentId}`;
  const method = mode === "create" ? "POST" : "PUT";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOk(null);
    setFieldErrors({});

    const parsed = upsertDocumentSchema.safeParse({
      ...formData,
      // In input vuoto usiamo "" e lo lasciamo passare: la schema lo accetta e lo API lo interpreta come null.
      expiryDate: formData.expiryDate,
      notes: formData.notes || null,
    });

    if (!parsed.success) {
      const nextErrors: DocumentFieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof UpsertDocumentInput] = issue.message;
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

      setOk(mode === "create" ? "Documento creato correttamente." : "Documento aggiornato correttamente.");
      router.push("/admin/documenti");
      router.refresh();
    } catch {
      setError("Errore imprevisto. Riprova.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-black text-blue-950">
          {mode === "create" ? "Nuovo documento atleta" : "Modifica documento atleta"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Archivio metadati Document. L&apos;upload file reale non è implementato su questo modello:
          usa un percorso testuale in FilePath. I file di iscrizione e i certificati medici restano
          nelle rispettive sezioni.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="athleteId">
              Atleta
            </label>
            <select
              id="athleteId"
              value={formData.athleteId}
              onChange={(event) => setFormData((prev) => ({ ...prev, athleteId: event.target.value }))}
              className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            >
              {athletes.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.fullName}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.athleteId} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="type">
              Tipo documento
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={(event) => setFormData((prev) => ({ ...prev, type: event.target.value as DocumentType }))}
              className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            >
              {DOCUMENT_TYPE_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            <FieldError message={fieldErrors.type} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="title">
              Titolo (descrizione breve)
            </label>
            <input
              id="title"
              value={formData.title}
              onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
              className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.title} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="expiryDate">
              Scadenza (facoltativa)
            </label>
            <input
              id="expiryDate"
              type="date"
              value={formData.expiryDate}
              onChange={(event) => setFormData((prev) => ({ ...prev, expiryDate: event.target.value }))}
              className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.expiryDate} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="filePath">
              FilePath (testuale)
            </label>
            <input
              id="filePath"
              value={formData.filePath}
              onChange={(event) => setFormData((prev) => ({ ...prev, filePath: event.target.value }))}
              placeholder="es. manual-placeholder/documenti/xyz.pdf"
              className="mt-1 min-h-11 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-blue-950 outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.filePath} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="notes">
              Note (facoltative)
            </label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-blue-950 outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.notes} />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}

        {ok ? (
          <p className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-blue-900">
            {ok}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-blue-800 px-4 text-sm font-bold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Salvataggio..." : mode === "create" ? "Crea documento" : "Salva modifiche"}
        </button>
      </section>
    </form>
  );
}
