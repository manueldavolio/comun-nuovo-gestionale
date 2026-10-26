"use client";

import { AdminShell } from "@/components/admin/admin-nav";
import { AdminDashboardHero } from "@/components/admin/admin-dashboard-hero";

export function AdminShellLabClient() {
  return (
    <AdminShell role="ADMIN">
      <main className="p-4 md:p-6 lg:p-8">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
          <AdminDashboardHero userName="Verifica locale" seasonLabel="2026/2027" />

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {["Atleti", "Categorie", "Pagamenti", "Alert"].map((title, i) => (
              <div
                key={title}
                className="rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/40 p-4 shadow-sm"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                  {title}
                </p>
                <p className="mt-2 text-3xl font-black text-blue-950">{[186, 12, 9, 7][i]}</p>
              </div>
            ))}
          </section>

          <section className="overflow-x-auto rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-blue-900">
              Tabella di prova overflow
            </h2>
            <table className="mt-3 min-w-[720px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-sky-100 text-zinc-500">
                  <th className="py-2 pr-4">Atleta</th>
                  <th className="py-2 pr-4">Categoria</th>
                  <th className="py-2 pr-4">Stato</th>
                  <th className="py-2">Note lunghe di prova layout</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-sky-50">
                  <td className="py-2 pr-4 font-semibold">Rossi Mario</td>
                  <td className="py-2 pr-4">Under 15</td>
                  <td className="py-2 pr-4">Attivo</td>
                  <td className="py-2">
                    Contenuto lungo per verificare assenza di scroll orizzontale involontario
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-blue-900">
              Form di prova (safe area bottom nav)
            </h2>
            <form className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-zinc-700">
                Titolo evento
                <input
                  className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2"
                  defaultValue="Allenamento"
                />
              </label>
              <label className="text-sm font-semibold text-zinc-700">
                Data
                <input
                  type="date"
                  className="mt-1 w-full rounded-xl border border-sky-200 px-3 py-2"
                  defaultValue="2026-10-26"
                />
              </label>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white"
              >
                Salva evento
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center rounded-xl border border-blue-200 px-4 text-sm font-bold text-blue-900"
              >
                Annulla
              </button>
            </div>
          </section>

          <div className="h-8" aria-hidden />
        </div>
      </main>
    </AdminShell>
  );
}
