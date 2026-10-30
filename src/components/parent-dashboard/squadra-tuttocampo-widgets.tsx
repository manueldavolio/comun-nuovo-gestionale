"use client";

import { useState } from "react";

export type SquadraWidgetUrls = {
  nextMatch: string | null;
  lastMatch: string | null;
  results: string | null;
  standings: string | null;
  scorers: string | null;
};

type TabId = "results" | "standings" | "scorers";

const ALL_TABS: Array<{ id: TabId; label: string; heightClass: string; competitive: boolean }> = [
  { id: "results", label: "Risultati", heightClass: "h-[560px] sm:h-[600px]", competitive: false },
  { id: "standings", label: "Classifica", heightClass: "h-[640px] sm:h-[800px]", competitive: true },
  { id: "scorers", label: "Marcatori", heightClass: "h-[560px] sm:h-[700px]", competitive: true },
];

function WidgetFrame({
  title,
  src,
  heightClass,
}: {
  title: string;
  src: string | null;
  heightClass: string;
}) {
  if (!src) {
    return (
      <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/60 px-3 py-6 text-center text-sm text-zinc-600">
        Widget {title.toLowerCase()} non configurato. Restano disponibili i dati interni del
        gestionale, se presenti.
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-hidden rounded-xl border border-sky-100 bg-white">
      <iframe
        title={title}
        src={src}
        className={`block w-full max-w-full border-0 ${heightClass}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

type Props = {
  widgets: SquadraWidgetUrls;
  competitionLabel: string | null;
  sourcePageUrl: string | null;
  /** false = attività di base: niente tab classifica/marcatori */
  allowCompetitiveWidgets: boolean;
};

export function SquadraTuttocampoWidgets({
  widgets,
  competitionLabel,
  sourcePageUrl,
  allowCompetitiveWidgets,
}: Props) {
  const tabs = ALL_TABS.filter((t) => allowCompetitiveWidgets || !t.competitive);
  const [tab, setTab] = useState<TabId>("results");
  const effectiveTab = tabs.some((t) => t.id === tab) ? tab : "results";
  const active = tabs.find((t) => t.id === effectiveTab) ?? tabs[0];
  const tabSrc =
    effectiveTab === "results"
      ? widgets.results
      : effectiveTab === "standings"
        ? widgets.standings
        : widgets.scorers;

  return (
    <section className="space-y-3 overflow-x-hidden">
      {competitionLabel ? (
        <p className="text-xs text-zinc-500">{competitionLabel}</p>
      ) : null}

      {!allowCompetitiveWidgets ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-950">
          Attività di base: mostriamo risultati e partite. Classifica e marcatori non sono
          visualizzati.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
            Prossima partita
          </p>
          <div className="mt-2">
            <WidgetFrame
              title="Prossima partita Tuttocampo"
              src={widgets.nextMatch}
              heightClass="h-[350px]"
            />
          </div>
        </div>
        <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
            Ultima partita
          </p>
          <div className="mt-2">
            <WidgetFrame
              title="Ultima partita Tuttocampo"
              src={widgets.lastMatch}
              heightClass="h-[350px]"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-white p-3 shadow-sm">
        <div
          role="tablist"
          aria-label="Widget Tuttocampo"
          className="flex gap-1 overflow-x-auto pb-1"
        >
          {tabs.map((item) => {
            const selected = item.id === effectiveTab;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={
                  selected
                    ? "shrink-0 rounded-full bg-blue-800 px-3 py-1.5 text-xs font-bold text-white"
                    : "shrink-0 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-blue-900"
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div role="tabpanel" className="mt-3">
          <WidgetFrame title={active.label} src={tabSrc} heightClass={active.heightClass} />
        </div>
        {sourcePageUrl ? (
          <a
            href={sourcePageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex text-xs font-bold text-blue-800 underline"
          >
            Apri fonte originale
          </a>
        ) : null}
      </div>
    </section>
  );
}
