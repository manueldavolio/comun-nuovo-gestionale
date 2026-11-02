import Link from "next/link";
import {
  PRIVACY_NOTICE_V1_BODY,
  PRIVACY_NOTICE_V1_TITLE,
  PRIVACY_NOTICE_V1_VERSION,
} from "@/lib/legal/document-bodies";
import {
  formatLegalPublicationDate,
  getCurrentLegalDocument,
} from "@/lib/legal/legal-documents";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const current = await getCurrentLegalDocument("PRIVACY_NOTICE").catch(() => null);
  const title = current?.title ?? PRIVACY_NOTICE_V1_TITLE;
  const version = current?.version ?? PRIVACY_NOTICE_V1_VERSION;
  const bodyText = current?.bodyText ?? PRIVACY_NOTICE_V1_BODY;
  const publicationLabel = formatLegalPublicationDate(current?.effectiveFrom ?? null);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="text-2xl font-semibold text-zinc-900 sm:text-3xl">
            Informativa Privacy ASD Comun Nuovo
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Versione {version} · {publicationLabel}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{title}</p>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-700 sm:text-[15px] sm:leading-7">
            {bodyText}
          </div>

          <div className="mt-6">
            <Link
              href="/genitore/iscrizione/nuova"
              className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Torna al form
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
