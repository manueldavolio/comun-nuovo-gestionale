import Link from "next/link";
import { redirect } from "next/navigation";
import type { MedicalVisitStatus } from "@prisma/client";
import { HeartPulse, Plus, Search } from "lucide-react";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { StatusBadge } from "@/components/layout/status-badge";
import { getAuthSession } from "@/lib/auth";
import { computeMedicalVisitStatus } from "@/lib/expiry-status";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  athleteListWhereForAdminRole,
  categoryListWhereForAdminRole,
} from "@/lib/youth-director-data-access";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type VisitFilter = "all" | "VALID" | "EXPIRING" | "EXPIRED" | "MISSING";

type VisitRow = {
  athleteId: string;
  athleteFullName: string;
  categoryId: string;
  categoryName: string;
  visitId: string | null;
  visitDate: Date | null;
  expiryDate: Date | null;
  status: MedicalVisitStatus | null;
  notes: string | null;
  certificateFilePath: string | null;
};

type AdminMedicalVisitsPageProps = {
  searchParams?: Promise<{ q?: string; status?: string; categoryId?: string }>;
};

function parseVisitFilter(value: string | undefined): VisitFilter {
  if (value === "VALID" || value === "EXPIRING" || value === "EXPIRED" || value === "MISSING") {
    return value;
  }
  return "all";
}

function matchesFilter(row: VisitRow, filter: VisitFilter) {
  if (filter === "all") return true;
  if (filter === "MISSING") return row.status === null;
  return row.status === filter;
}

export default async function AdminMedicalVisitsPage({ searchParams }: AdminMedicalVisitsPageProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/visite-mediche");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const params = searchParams ? await searchParams : {};
  const q = (params?.q ?? "").trim();
  const statusFilter = parseVisitFilter(params?.status);
  const categoryId = (params?.categoryId ?? "").trim();

  const now = new Date();
  const athleteScope = athleteListWhereForAdminRole(session.user.role);
  const categoryScope = categoryListWhereForAdminRole(session.user.role, true);
  if (!athleteScope || !categoryScope) {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const [athletes, categories] = await Promise.all([
    prisma.athlete.findMany({
      where: athleteScope,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        medicalVisits: {
          orderBy: { visitDate: "desc" },
          take: 1,
          select: {
            id: true,
            visitDate: true,
            expiryDate: true,
            notes: true,
            certificateFilePath: true,
          },
        },
      },
    }),
    prisma.category.findMany({
      where: categoryScope,
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const rows: VisitRow[] = athletes.map((athlete) => {
    const latest = athlete.medicalVisits[0] ?? null;
    if (!latest) {
      return {
        athleteId: athlete.id,
        athleteFullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
        categoryId: athlete.categoryId,
        categoryName: athlete.category.name,
        visitId: null,
        visitDate: null,
        expiryDate: null,
        status: null,
        notes: null,
        certificateFilePath: null,
      };
    }

    return {
      athleteId: athlete.id,
      athleteFullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
      categoryId: athlete.categoryId,
      categoryName: athlete.category.name,
      visitId: latest.id,
      visitDate: latest.visitDate,
      expiryDate: latest.expiryDate,
      status: computeMedicalVisitStatus(latest.expiryDate, now),
      notes: latest.notes ?? null,
      certificateFilePath: latest.certificateFilePath ?? null,
    };
  });

  const validCount = rows.filter((r) => r.status === "VALID").length;
  const expiringCount = rows.filter((r) => r.status === "EXPIRING").length;
  const expiredCount = rows.filter((r) => r.status === "EXPIRED").length;
  const missingCount = rows.filter((r) => r.status === null).length;

  const qNormalized = q.toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (categoryId && row.categoryId !== categoryId) {
      return false;
    }
    if (!matchesFilter(row, statusFilter)) {
      return false;
    }
    if (!qNormalized) {
      return true;
    }
    return row.athleteFullName.toLowerCase().includes(qNormalized);
  });

  const priorityExpired = filteredRows.filter((r) => r.status === "EXPIRED");
  const priorityExpiring = filteredRows.filter((r) => r.status === "EXPIRING");
  const priorityMissing = filteredRows.filter((r) => r.status === null);
  const showPriorityBlocks = statusFilter === "all";
  // Con filtri aperti le criticità stanno solo nelle sezioni prioritarie;
  // l'elenco completo mostra i soli VALIDI per evitare duplicazioni.
  const listRows = showPriorityBlocks
    ? filteredRows.filter((r) => r.status === "VALID")
    : filteredRows;

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 md:gap-5">
        <header className="overflow-hidden rounded-3xl border border-blue-800/30 bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 text-white shadow-lg shadow-blue-950/15">
          <div className="relative p-5 sm:p-6">
            <div
              className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl"
              aria-hidden
            />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                  <HeartPulse className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
                    Sanitario
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                    Visite mediche
                  </h1>
                  <p className="mt-1 text-sm font-medium text-sky-100">
                    {rows.length} atleti in elenco · ultima visita per atleta
                  </p>
                </div>
              </div>
              <Link
                href="/admin/visite-mediche/nuovo"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-blue-900 shadow-sm transition hover:bg-sky-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Nuova visita
              </Link>
            </div>
          </div>
        </header>

        <AdminBackLink />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
              Validi
            </p>
            <p className="mt-2 text-2xl font-black text-blue-950">{validCount}</p>
          </article>
          <article className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800/80">
              In scadenza
            </p>
            <p className="mt-2 text-2xl font-black text-amber-950">{expiringCount}</p>
            <p className="mt-1 text-[11px] font-medium text-amber-900/80">
              UI: meno di 30 giorni (giorno 30 = valido)
            </p>
          </article>
          <article className="rounded-3xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-800/80">
              Scaduti
            </p>
            <p className="mt-2 text-2xl font-black text-red-950">{expiredCount}</p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
              Senza visita
            </p>
            <p className="mt-2 text-2xl font-black text-slate-900">{missingCount}</p>
          </article>
        </section>

        <p className="text-xs font-medium text-zinc-500">
          Stati calcolati dai dati registrati (scadenza visita), non da una validazione medica
          esterna. Conteggi sull&apos;elenco atleti di questa pagina. I reminder email (solo ADMIN,
          dalla dashboard) usano una soglia diversa sul giorno 30: non modificata in D3.2.
        </p>

        <section className="rounded-3xl border border-sky-100 bg-white/95 p-4 shadow-sm sm:p-5">
          <form method="get" className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Cerca atleta</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400"
                aria-hidden
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Cerca atleta"
                className="min-h-12 w-full rounded-2xl border border-sky-200 bg-sky-50/50 py-2.5 pl-10 pr-3 text-sm font-medium text-blue-950 outline-none ring-blue-500 placeholder:text-zinc-400 focus:bg-white focus:ring-2"
              />
            </label>
            <select
              name="status"
              defaultValue={statusFilter === "all" ? "" : statusFilter}
              aria-label="Filtro stato visita"
              className="min-h-12 rounded-2xl border border-sky-200 bg-white px-3 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            >
              <option value="">Tutti gli stati</option>
              <option value="EXPIRED">Scaduti</option>
              <option value="EXPIRING">In scadenza</option>
              <option value="MISSING">Senza visita</option>
              <option value="VALID">Validi</option>
            </select>
            <select
              name="categoryId"
              defaultValue={categoryId}
              aria-label="Filtro categoria"
              className="min-h-12 rounded-2xl border border-sky-200 bg-white px-3 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            >
              <option value="">Tutte le categorie</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-blue-800 px-5 text-sm font-bold text-white transition hover:bg-blue-900"
              >
                Filtra
              </button>
              {q || statusFilter !== "all" || categoryId ? (
                <Link
                  href="/admin/visite-mediche"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-800 hover:bg-sky-50"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </form>
        </section>

        {showPriorityBlocks ? (
          <>
            <PrioritySection
              title={`Scaduti (${priorityExpired.length})`}
              empty="Nessun certificato scaduto con i filtri attuali."
              rows={priorityExpired}
              tone="bad"
            />
            <PrioritySection
              title={`In scadenza (${priorityExpiring.length})`}
              empty="Nessun certificato in scadenza con i filtri attuali."
              rows={priorityExpiring}
              tone="warn"
            />
            <PrioritySection
              title={`Senza visita (${priorityMissing.length})`}
              empty="Tutti gli atleti filtrati hanno una visita registrata."
              rows={priorityMissing}
              tone="mute"
            />
          </>
        ) : null}

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-blue-950">
            {showPriorityBlocks
              ? `Certificati validi (${listRows.length})`
              : `Elenco filtrato (${listRows.length})`}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Solo l&apos;ultima visita per atleta.
            {showPriorityBlocks
              ? " Qui restano i soli stati validi; scaduti, in scadenza e mancanti sono nelle sezioni sopra."
              : null}
          </p>

          {listRows.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-4 py-8 text-center text-sm text-zinc-600">
              Nessun risultato con i filtri selezionati.
            </p>
          ) : (
            <>
              <ul className="mt-4 grid gap-3 md:hidden">
                {listRows.map((row) => (
                  <VisitCard key={row.athleteId} row={row} />
                ))}
              </ul>
              <div className="mt-4 hidden overflow-hidden rounded-2xl border border-sky-100 md:block">
                <VisitTable rows={listRows} />
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function PrioritySection({
  title,
  empty,
  rows,
  tone,
}: {
  title: string;
  empty: string;
  rows: VisitRow[];
  tone: "bad" | "warn" | "mute";
}) {
  const border =
    tone === "bad"
      ? "border-red-200"
      : tone === "warn"
        ? "border-amber-200"
        : "border-slate-200";

  return (
    <section className={`rounded-3xl border ${border} bg-white p-4 shadow-sm sm:p-5`}>
      <h2 className="text-base font-black text-blue-950">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-4 py-4 text-sm text-zinc-600">
          {empty}
        </p>
      ) : (
        <>
          <ul className="mt-3 grid gap-3 md:hidden">
            {rows.map((row) => (
              <VisitCard key={`prio-m-${row.athleteId}`} row={row} />
            ))}
          </ul>
          <div className="mt-3 hidden overflow-hidden rounded-2xl border border-sky-100 md:block">
            <VisitTable rows={rows} />
          </div>
        </>
      )}
    </section>
  );
}

function VisitTable({ rows }: { rows: VisitRow[] }) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-sky-100 bg-sky-50/50 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
          <th className="px-4 py-3">Atleta</th>
          <th className="px-4 py-3">Categoria</th>
          <th className="px-4 py-3">Scadenza</th>
          <th className="px-4 py-3">Stato</th>
          <th className="px-4 py-3">Certificato</th>
          <th className="px-4 py-3">Azioni</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.athleteId}
            className="border-b border-sky-50 align-top last:border-0 hover:bg-sky-50/40"
          >
            <td className="px-4 py-3">
              <Link
                href={`/admin/atleti/${row.athleteId}`}
                className="font-bold text-blue-900 hover:underline"
              >
                {row.athleteFullName}
              </Link>
              {row.visitDate ? (
                <p className="mt-0.5 text-xs text-zinc-500">
                  Visita {dateFormatter.format(new Date(row.visitDate))}
                </p>
              ) : null}
            </td>
            <td className="px-4 py-3 text-zinc-700">{row.categoryName}</td>
            <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
              {row.expiryDate ? dateFormatter.format(new Date(row.expiryDate)) : "—"}
            </td>
            <td className="px-4 py-3">
              {row.status ? (
                <StatusBadge status={row.status} />
              ) : (
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
                  Nessuna visita
                </span>
              )}
            </td>
            <td className="px-4 py-3">
              {row.visitId && row.certificateFilePath ? (
                <a
                  href={`/api/admin/medical-visits/${row.visitId}/certificate/download`}
                  className="inline-flex rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-sky-100"
                >
                  Scarica
                </a>
              ) : (
                <span className="text-xs font-medium text-zinc-500">
                  {row.visitId ? "Non caricato" : "—"}
                </span>
              )}
            </td>
            <td className="px-4 py-3">
              {row.visitId ? (
                <Link
                  href={`/admin/visite-mediche/${row.visitId}/modifica`}
                  className="inline-flex min-h-10 items-center rounded-xl border border-blue-200 bg-white px-3 text-xs font-bold text-blue-800 hover:bg-blue-50"
                >
                  Modifica
                </Link>
              ) : (
                <Link
                  href={`/admin/visite-mediche/nuovo?athleteId=${row.athleteId}`}
                  className="inline-flex min-h-10 items-center rounded-xl bg-blue-800 px-3 text-xs font-bold text-white hover:bg-blue-900"
                >
                  Inserisci
                </Link>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VisitCard({ row }: { row: VisitRow }) {
  return (
    <li className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/admin/atleti/${row.athleteId}`}
            className="text-base font-black text-blue-950 hover:underline"
          >
            {row.athleteFullName}
          </Link>
          <p className="mt-1 text-xs font-medium text-zinc-500">{row.categoryName}</p>
        </div>
        {row.status ? (
          <StatusBadge status={row.status} />
        ) : (
          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200">
            Nessuna visita
          </span>
        )}
      </div>
      <p className="mt-3 text-sm text-zinc-600">
        Scadenza:{" "}
        <span className="font-semibold text-blue-950">
          {row.expiryDate ? dateFormatter.format(new Date(row.expiryDate)) : "—"}
        </span>
      </p>
      <div className="mt-4 flex flex-col gap-2 border-t border-sky-100 pt-3">
        {row.visitId && row.certificateFilePath ? (
          <a
            href={`/api/admin/medical-visits/${row.visitId}/certificate/download`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-bold text-blue-800"
          >
            Scarica certificato
          </a>
        ) : null}
        {row.visitId ? (
          <Link
            href={`/admin/visite-mediche/${row.visitId}/modifica`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-blue-800"
          >
            Modifica
          </Link>
        ) : (
          <Link
            href={`/admin/visite-mediche/nuovo?athleteId=${row.athleteId}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-800 px-3 text-sm font-bold text-white"
          >
            Inserisci visita
          </Link>
        )}
      </div>
    </li>
  );
}
