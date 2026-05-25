"use client";

import { useId } from "react";
import {
  ENROLLMENT_DOCUMENT_MAX_BYTES,
  inferEnrollmentDocumentMime,
  isAllowedEnrollmentDocumentMime,
} from "@/lib/enrollment-documents";

type EnrollmentFileFieldProps = {
  id: string;
  label: string;
  selectedFile: File | null;
  error?: string;
  onChange: (file: File | null, error?: string) => void;
};

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export function EnrollmentFileField({
  id,
  label,
  selectedFile,
  error,
  onChange,
}: EnrollmentFileFieldProps) {
  const hintId = useId();

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      onChange(null, "Seleziona un file.");
      return;
    }

    const mimeType = inferEnrollmentDocumentMime(file.name, file.type || "");
    if (!isAllowedEnrollmentDocumentMime(mimeType)) {
      onChange(null, "Formato non valido. Usa PDF, JPG, JPEG o PNG.");
      return;
    }

    if (file.size > ENROLLMENT_DOCUMENT_MAX_BYTES) {
      onChange(null, "Il file supera i 10 MB.");
      return;
    }

    onChange(file);
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
      <label className="text-sm font-medium text-zinc-700" htmlFor={id}>
        {label} <span className="text-red-600">*</span>
      </label>
      <input
        id={id}
        type="file"
        accept={ACCEPT}
        aria-describedby={hintId}
        onChange={handleChange}
        className="mt-2 block w-full cursor-pointer text-sm text-zinc-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-blue-700 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-blue-800"
      />
      <p id={hintId} className="mt-1 text-xs text-zinc-500">
        PDF, JPG, JPEG o PNG — max 10 MB
      </p>
      {selectedFile ? (
        <p className="mt-2 break-all text-xs font-medium text-emerald-700">
          File selezionato: {selectedFile.name}
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">Nessun file selezionato</p>
      )}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
