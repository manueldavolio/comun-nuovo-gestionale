import {
  ENROLLMENT_DOCUMENT_TYPE_LABEL,
  ENROLLMENT_DOCUMENT_TYPES_ORDER,
} from "@/lib/enrollment-document-types";
import type { EnrollmentDocumentType } from "@prisma/client";

type EnrollmentDocumentRow = {
  id: string;
  type: EnrollmentDocumentType;
  fileName: string;
};

type AthleteEnrollmentDocumentsProps = {
  documents: EnrollmentDocumentRow[];
};

export function AthleteEnrollmentDocuments({ documents }: AthleteEnrollmentDocumentsProps) {
  const documentsByType = new Map(documents.map((document) => [document.type, document]));

  return (
    <ul className="mt-4 divide-y divide-blue-50 rounded-lg border border-blue-100">
      {ENROLLMENT_DOCUMENT_TYPES_ORDER.map((type) => {
        const document = documentsByType.get(type);
        return (
          <li
            key={type}
            className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-zinc-900">
                {ENROLLMENT_DOCUMENT_TYPE_LABEL[type]}
              </p>
              {document ? (
                <p className="mt-0.5 break-all text-xs text-zinc-500">{document.fileName}</p>
              ) : (
                <p className="mt-0.5 text-xs text-zinc-500">Non caricato</p>
              )}
            </div>
            {document ? (
              <a
                href={`/api/admin/enrollment-documents/${document.id}/download`}
                className="inline-flex w-fit items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                Scarica
              </a>
            ) : (
              <span className="inline-flex w-fit items-center rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-500">
                Non caricato
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
