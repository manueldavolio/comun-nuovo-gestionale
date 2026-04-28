"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { UpsertMedicalVisitInput } from "@/lib/validation/medical-visits";
import { upsertMedicalVisitSchema } from "@/lib/validation/medical-visits";

type AthleteOption = {
  id: string;
  fullName: string;
};

type MedicalVisitFormProps = {
  mode: "create" | "edit";
  medicalVisitId?: string;
  athletes: AthleteOption[];
  initialValues: {
    athleteId: string;
    visitDate: string; // YYYY-MM-DD
    expiryDate: string; // YYYY-MM-DD
    notes: string;
    certificateFilePath: string;
  };
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

type MedicalVisitFieldErrors = Partial<Record<keyof UpsertMedicalVisitInput, string>>;

export function MedicalVisitForm({ mode, medicalVisitId, athletes, initialValues }: MedicalVisitFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<MedicalVisitFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCertificateFile, setSelectedCertificateFile] = useState<File | null>(null);
  const [isUploadingCertificate, setIsUploadingCertificate] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);

  const existingCertificateFileName = useMemo(() => {
    if (!formData.certificateFilePath) return null;
    const normalized = formData.certificateFilePath.replaceAll("\\", "/");
    const parts = normalized.split("/");
    return parts[parts.length - 1] ?? normalized;
  }, [formData.certificateFilePath]);

  const apiUrl =
    mode === "create" ? "/api/admin/medical-visits" : `/api/admin/medical-visits/${medicalVisitId}`;
  const method = mode === "create" ? "POST" : "PUT";

  async function uploadCertificateIfNeeded() {
    if (!selectedCertificateFile) {
      return formData.certificateFilePath || null;
    }

    if (selectedCertificateFile.size > 10 * 1024 * 1024) {
      throw new Error("Il file supera la dimensione massima di 10 MB.");
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(selectedCertificateFile.type)) {
      throw new Error("Formato non valido. Sono ammessi PDF, JPG, PNG.");
    }

    setIsUploadingCertificate(true);
    const uploadForm = new FormData();
    uploadForm.append("certificate", selectedCertificateFile);

    const response = await fetch("/api/admin/medical-visits/upload-certificate", {
      method: "POST",
      body: uploadForm,
    });

    const body = (await response.json().catch(() => null)) as
      | {
          error?: string;
          data?: { storedPath?: string };
        }
      | null;

    if (!response.ok || !body?.data?.storedPath) {
      throw new Error(body?.error ?? "Caricamento certificato non riuscito.");
    }

    return body.data.storedPath;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setOk(null);
    setCertificateError(null);
    setFieldErrors({});

    const parsed = upsertMedicalVisitSchema.safeParse({
      athleteId: formData.athleteId,
      visitDate: formData.visitDate,
      expiryDate: formData.expiryDate,
      notes: formData.notes || null,
      certificateFilePath: formData.certificateFilePath || null,
    });

    if (!parsed.success) {
      const nextErrors: MedicalVisitFieldErrors = {};
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (typeof field === "string" && !(field in nextErrors)) {
          nextErrors[field as keyof UpsertMedicalVisitInput] = issue.message;
        }
      });
      setFieldErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedCertificatePath = await uploadCertificateIfNeeded();
      setIsUploadingCertificate(false);

      const response = await fetch(apiUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          certificateFilePath: uploadedCertificatePath,
        }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(body?.error ?? "Operazione non riuscita. Riprova.");
        setIsSubmitting(false);
        return;
      }

      setOk(mode === "create" ? "Visita medica creata correttamente." : "Visita medica aggiornata correttamente.");
      router.push("/admin/visite-mediche");
      router.refresh();
    } catch (submitError) {
      setIsUploadingCertificate(false);
      const message = submitError instanceof Error ? submitError.message : "Errore imprevisto. Riprova.";
      if (
        message.includes("Caricamento certificato") ||
        message.includes("Formato non valido") ||
        message.includes("10 MB")
      ) {
        setCertificateError(message);
      } else {
        setError(message);
      }
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          {mode === "create" ? "Nuova visita medica" : "Modifica visita medica"}
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Lo stato viene calcolato in base alla scadenza: `VALID`, `EXPIRING` (meno di 30 giorni), `EXPIRED`.
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
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
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
            <label className="text-sm font-medium text-zinc-700" htmlFor="visitDate">
              Data visita
            </label>
            <input
              id="visitDate"
              type="date"
              value={formData.visitDate}
              onChange={(event) => setFormData((prev) => ({ ...prev, visitDate: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.visitDate} />
          </div>

          <div>
            <label className="text-sm font-medium text-zinc-700" htmlFor="expiryDate">
              Scadenza
            </label>
            <input
              id="expiryDate"
              type="date"
              value={formData.expiryDate}
              onChange={(event) => setFormData((prev) => ({ ...prev, expiryDate: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.expiryDate} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="certificateFileUpload">
              Certificato medico
            </label>
            <p className="mt-1 text-xs text-zinc-500">Formati ammessi: PDF, JPG, PNG - massimo 10 MB.</p>
            {existingCertificateFileName ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <span className="font-semibold">Certificato caricato</span>
                {mode === "edit" && medicalVisitId ? (
                  <a
                    href={`/api/admin/medical-visits/${medicalVisitId}/certificate/download`}
                    className="inline-flex items-center rounded-md border border-emerald-300 bg-white px-2 py-1 font-semibold text-emerald-800 hover:bg-emerald-100"
                  >
                    Scarica
                  </a>
                ) : null}
              </div>
            ) : null}
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label
                htmlFor="certificateFileUpload"
                className="inline-flex w-fit cursor-pointer items-center justify-center rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:bg-blue-100"
              >
                {selectedCertificateFile ? "Sostituisci file" : "Carica certificato"}
              </label>
              <input
                id="certificateFileUpload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] ?? null;
                  setSelectedCertificateFile(nextFile);
                  setCertificateError(null);
                }}
                className="sr-only"
              />
              <span className="text-sm text-zinc-700">
                {selectedCertificateFile?.name ?? existingCertificateFileName ?? "Nessun file selezionato"}
              </span>
            </div>
            {certificateError ? (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {certificateError}
              </p>
            ) : null}
            <FieldError message={fieldErrors.certificateFilePath} />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm font-medium text-zinc-700" htmlFor="notes">
              Note
            </label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            />
            <FieldError message={fieldErrors.notes} />
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        {ok ? (
          <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {ok}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || isUploadingCertificate}
          className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploadingCertificate
            ? "Caricamento certificato..."
            : isSubmitting
              ? "Salvataggio..."
              : mode === "create"
                ? "Crea visita"
                : "Salva modifiche"}
        </button>
      </section>
    </form>
  );
}

