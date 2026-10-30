import { AdminBackLink } from "@/components/admin/admin-back-link";
import { CompetitionSourceForm } from "@/components/family-benefits/competition-source-form";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteWebNav } from "@/components/site-web/site-web-nav";
import {
  ESORDIENTI_TUTTOCAMPO_WIDGET,
  TUTTOCAMPO_CATEGORY_UUID_SLOTS,
  sourceTypeLabel,
  VERIFIED_2026_27_COMPETITION_HINTS,
} from "@/lib/team-competition";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

export default async function AdminFontiClassificaPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/fonti-classifica");
  const [categories, sources] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ seasonLabel: "desc" }, { name: "asc" }],
      select: { id: true, name: true, seasonLabel: true, sector: true },
    }),
    prisma.categoryCompetitionSource.findMany({
      include: { category: { select: { name: true, seasonLabel: true } } },
      orderBy: [{ seasonLabel: "desc" }, { competitionName: "asc" }],
    }),
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Fonti classifica e risultati"
          subtitle="Collega categorie a Tuttocampo/CRL o aggiornamento manuale"
          userName={session.user.name ?? "Amministratore"}
        />
        <AdminBackLink href="/admin/sito-web" label="← Torna a Sito web" />
        <SiteWebNav />

        <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
          <p className="font-bold">UUID Tuttocampo per categoria (modificabili qui, senza codice)</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
            {TUTTOCAMPO_CATEGORY_UUID_SLOTS.map((slot) => (
              <li key={slot.key}>
                {slot.label}:{" "}
                {slot.uuidKnown ? (
                  <span className="font-mono">{slot.uuidKnown}</span>
                ) : (
                  "da inserire"
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs">{ESORDIENTI_TUTTOCAMPO_WIDGET.note}</p>
          <p className="mt-2 font-bold">Hint campionati 2026/27</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">
            {VERIFIED_2026_27_COMPETITION_HINTS.map((hint) => (
              <li key={hint.competitionName}>
                {hint.competitionName}
                {hint.groupLabel ? ` · ${hint.groupLabel}` : ""} · verificato {hint.verifiedAt}
                {hint.sourcePageUrl ? (
                  <>
                    {" "}
                    ·{" "}
                    <a
                      href={hint.sourcePageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      pagina fonte
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <CompetitionSourceForm
          categories={categories}
          initialValues={{
            categoryId: categories[0]?.id ?? "",
            seasonLabel: categories[0]?.seasonLabel ?? "2026/2027",
            competitionName: "",
            groupLabel: "",
            sourceType: "NONE",
            sourcePageUrl: "",
            tuttocampoWidgetUuid: "",
            widgetSeasonParam: "2026-27",
            widgetStandingsUrl: "",
            widgetResultsUrl: "",
            widgetScorersUrl: "",
            widgetLastMatchUrl: "",
            widgetNextMatchUrl: "",
            manualStandingsJson: "",
            sourceNotes: "",
            lastVerifiedAt: "",
            isActive: true,
          }}
        />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-base font-black text-blue-950">Fonti salvate</h2>
          {sources.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nessuna fonte configurata.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {sources.map((s) => (
                <li key={s.id} className="rounded-lg border border-sky-100 px-3 py-2">
                  <p className="font-bold text-blue-950">
                    {s.category.name} · {s.competitionName}
                    {s.groupLabel ? ` (${s.groupLabel})` : ""}
                  </p>
                  <p className="text-xs text-zinc-600">
                    {sourceTypeLabel(s.sourceType)} ·{" "}
                    {s.lastVerifiedAt
                      ? `verificata ${s.lastVerifiedAt.toISOString().slice(0, 10)}`
                      : "data verifica assente"}
                    {s.tuttocampoWidgetUuid
                      ? ` · UUID ${s.tuttocampoWidgetUuid.slice(0, 8)}…`
                      : s.widgetStandingsUrl
                        ? " · widget classifica OK"
                        : " · senza widget"}
                    {s.widgetSeasonParam ? ` · y=${s.widgetSeasonParam}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
