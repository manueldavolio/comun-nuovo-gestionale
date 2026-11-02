import Link from "next/link";
import {
  SOCIETY_REGULATION_V1_BODY,
  SOCIETY_REGULATION_V1_TITLE,
  SOCIETY_REGULATION_V1_VERSION,
} from "@/lib/legal/document-bodies";
import {
  formatLegalPublicationDate,
  getCurrentLegalDocument,
} from "@/lib/legal/legal-documents";

export const dynamic = "force-dynamic";

function renderRegulationBody(bodyText: string) {
  const paragraphs = bodyText.split(/\n\n+/).map((block) => block.trim()).filter(Boolean);

  return (
    <div className="space-y-4 text-sm leading-6 text-zinc-700 sm:text-[15px] sm:leading-7">
      {paragraphs.map((block, index) => {
        const lines = block.split("\n");
        const isBulletBlock = lines.every((line) => line.trim().startsWith("•") || line.trim() === "");
        if (isBulletBlock) {
          return (
            <ul key={`ul-${index}`} className="list-disc space-y-2 pl-5">
              {lines
                .map((line) => line.replace(/^•\s*/, "").trim())
                .filter(Boolean)
                .map((line, lineIndex) => (
                  <li key={`li-${index}-${lineIndex}`}>{line}</li>
                ))}
            </ul>
          );
        }

        const looksLikeHeading =
          /^(\d+\.\s|[A-ZÀ-Ö].{0,80}$)/.test(lines[0] ?? "") && lines.length <= 2 && !lines[0]?.includes("•");

        if (looksLikeHeading && /^\d+\.\s/.test(lines[0] ?? "")) {
          return (
            <h2 key={`h-${index}`} className="pt-2 text-base font-semibold text-zinc-900 sm:text-lg">
              {block}
            </h2>
          );
        }

        return (
          <p key={`p-${index}`} className="whitespace-pre-wrap">
            {block}
          </p>
        );
      })}
    </div>
  );
}

export default async function RegolamentoPage() {
  const current = await getCurrentLegalDocument("SOCIETY_REGULATION").catch(() => null);
  const title = current?.title ?? SOCIETY_REGULATION_V1_TITLE;
  const version = current?.version ?? SOCIETY_REGULATION_V1_VERSION;
  const bodyText = current?.bodyText ?? SOCIETY_REGULATION_V1_BODY;
  const publicationLabel = formatLegalPublicationDate(current?.effectiveFrom ?? null);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <section className="rounded-xl border border-blue-100 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
            ASD Comun Nuovo · Stagione 2026/2027
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-900 sm:text-3xl">
            Regolamento interno per l&apos;attività sportiva
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Versione {version} · {publicationLabel}
          </p>
          <p className="mt-1 text-xs text-zinc-500">{title}</p>

          <div className="mt-6 border-t border-zinc-100 pt-5">{renderRegulationBody(bodyText)}</div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/genitore/iscrizione/nuova"
              className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Torna al form
            </Link>
            <a
              href="/docs/Regolamento_ASD_Comun_Nuovo_2026-2027.pdf"
              className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-50"
              target="_blank"
              rel="noopener noreferrer"
            >
              Scarica PDF ufficiale
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
