import { notFound } from "next/navigation";
import { SquadraTuttocampoWidgets } from "@/components/parent-dashboard/squadra-tuttocampo-widgets";
import {
  ESORDIENTI_TUTTOCAMPO_WIDGET,
  ESORDIENTI_TUTTOCAMPO_WIDGET_UUID,
  buildTuttocampoWidgetUrls,
  filterWidgetsByCategoryPolicy,
} from "@/lib/team-competition";

/**
 * Lab locale SOLO development. Fuori dal matcher middleware.
 * In production → 404 (non esporre widget UUID in chiaro).
 */
export default function SquadraWidgetsLabPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const raw = buildTuttocampoWidgetUrls(
    ESORDIENTI_TUTTOCAMPO_WIDGET_UUID,
    ESORDIENTI_TUTTOCAMPO_WIDGET.widgetSeasonParam,
  );
  const esordientiWidgets = filterWidgetsByCategoryPolicy(
    {
      results: raw.results,
      standings: raw.standings,
      scorers: raw.scorers,
      lastMatch: raw.lastMatch,
      nextMatch: raw.nextMatch,
    },
    "Esordienti",
    "YOUTH",
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-gradient-to-b from-sky-100 to-blue-50 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <header className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
            Lab anteprima
          </p>
          <h1 className="mt-1 text-2xl font-black text-blue-950">Esordienti · widget</h1>
          <p className="mt-2 text-sm text-zinc-600">
            UUID{" "}
            <span className="font-mono text-xs">{ESORDIENTI_TUTTOCAMPO_WIDGET_UUID}</span> ·{" "}
            <code>?y=2026-27</code>. Policy attività di base: risultati/partite sì, classifica e
            marcatori no.
          </p>
        </header>

        <SquadraTuttocampoWidgets
          widgets={esordientiWidgets}
          competitionLabel="Esordienti · stagione widget 2026-27"
          sourcePageUrl={null}
          allowCompetitiveWidgets={false}
        />
      </div>
    </main>
  );
}
