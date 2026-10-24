"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { SocialGraphicListItem } from "@/lib/social-studio/dto";
import { SOCIAL_FORMAT_LABEL, SOCIAL_TEMPLATE_LABEL } from "@/lib/social-studio/templates";

type StudioArchiveProps = {
  initialItems: SocialGraphicListItem[];
  categories: Array<{ id: string; name: string }>;
  userName: string;
};

export function StudioArchive({ initialItems, categories, userName }: StudioArchiveProps) {
  const [q, setQ] = useState("");
  const [categoryName, setCategoryName] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initialItems.filter((item) => {
      if (status !== "ALL" && item.status !== status) return false;
      if (categoryName !== "ALL" && item.categoryName !== categoryName) return false;
      if (!needle) return true;
      return (
        item.title.toLowerCase().includes(needle) ||
        (item.opponentName ?? "").toLowerCase().includes(needle) ||
        (item.categoryName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [initialItems, q, categoryName, status]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-6">
      <header className="rounded-2xl border border-blue-700 bg-blue-800 p-5 text-white shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
              Comun Nuovo Calcio
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">Social Studio</h1>
            <p className="mt-1 text-sm text-sky-100">
              Bozze e grafiche · {userName}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/social/studio/nuovo"
              className="inline-flex min-h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-blue-900"
            >
              Nuova grafica
            </Link>
            <Link
              href="/social/calendario"
              className="inline-flex min-h-10 items-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-blue-950"
            >
              Calendario
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Cerca
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Squadra, categoria, titolo…"
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Categoria
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
            >
              <option value="ALL">Tutte</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Stato
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="ALL">Tutti</option>
              <option value="DRAFT">Bozza</option>
              <option value="EXPORTED">Esportata</option>
              <option value="ARCHIVED">Archiviata</option>
            </select>
          </label>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-blue-200 bg-white p-6 text-center text-sm text-zinc-600">
            Nessuna grafica trovata. Crea la prima da una partita del calendario.
          </p>
        ) : (
          filtered.map((item) => (
            <Link
              key={item.id}
              href={`/social/studio/${item.id}`}
              className="rounded-2xl border border-blue-100 border-l-4 border-l-blue-700 bg-white p-4 shadow-sm transition hover:bg-sky-50/50"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-blue-800">
                    {SOCIAL_TEMPLATE_LABEL[item.template]} · {SOCIAL_FORMAT_LABEL[item.format]}
                  </p>
                  <h2 className="mt-1 text-base font-bold text-zinc-900">{item.title}</h2>
                  <p className="mt-1 text-sm text-zinc-600">
                    {[item.categoryName, item.opponentName].filter(Boolean).join(" · ") ||
                      "Senza partita collegata"}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Aggiornata {new Date(item.updatedAt).toLocaleString("it-IT")}
                    {item.updatedByName ? ` · ${item.updatedByName}` : ""}
                  </p>
                </div>
                <span className="rounded-full border border-blue-100 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-blue-900">
                  {item.status}
                </span>
              </div>
            </Link>
          ))
        )}
      </section>
    </div>
  );
}
