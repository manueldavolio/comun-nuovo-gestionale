import Link from "next/link";
import { redirect } from "next/navigation";
import type { DocumentType } from "@prisma/client";
import { FileText, Plus, Search } from "lucide-react";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { StatusBadge } from "@/components/layout/status-badge";
import { getAuthSession } from "@/lib/auth";
import { DOCUMENT_TYPE_CHOICES, DOCUMENT_TYPE_LABEL } from "@/lib/document-types";
import {
  computeExpiryBadgeStatus,
  type ExpiryBadgeStatus,
} from "@/lib/expiry-status";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type StatusFilter = "all" | ExpiryBadgeStatus;

type DocumentRow = {
  id: string;
  athleteId: string;
  athleteFullName: string;
  type: DocumentType;
  title: string;
  expiryDate: Date | null;
  status: ExpiryBadgeStatus;
};

type AdminAthleteDocumentsPageProps = {
  searchParams?: Promise<{ q?: string; status?: string; type?: string }>;
};

function parseStatusFilter(value: string | undefined): StatusFilter {
  if (
    value === "VALID" ||
    value === "EXPIRING" ||
    value === "EXPIRED" ||
    value === "NO_EXPIRY"
  ) {
    return value;
  }
  return "all";
}

function isDocumentType(value: string): value is DocumentType {
  return DOCUMENT_TYPE_CHOICES.some((choice) => choice.value === value);
}

export default async function AdminAthleteDocumentsPage({
  searchParams,
}: AdminAthleteDocumentsPageProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/documenti");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const params = searchParams ? await searchParams : {};
  const q = (params?.q ?? "").trim();
  const statusFilter = parseStatusFilter(params?.status);
  const typeFilter = isDocumentType(params?.type ?? "") ? (params.type as DocumentType) : "";

  const now = new Date();

  const athletes = await prisma.athlete.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, title: true, expiryDate: true },
      },
    },
  });

  const rows: DocumentRow[] = athletes.flatMap((athlete) => {
    const athleteFullName = `${athlete.firstName} ${athlete.lastName}`.trim();
    return athlete.documents.map((doc) => ({
      id: doc.id,
      athleteId: athlete.id,
      athleteFullName,
      type: doc.type,
      title: doc.title,
      expiryDate: doc.expiryDate,
      status: computeExpiryBadgeStatus(doc.expiryDate, now),
    }));
  });

  const validCount = rows.filter((r) => r.status === "VALID").length;
  const expiringCount = rows.filter((r) => r.status === "EXPIRING").length;
  const expiredCount = rows.filter((r) => r.status === "EXPIRED").length;
  const noExpiryCount = rows.filter((r) => r.status === "NO_EXPIRY").length;

  const qNormalized = q.toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) {
      return false;
    }
    if (typeFilter && row.type !== typeFilter) {
      return false;
    }
    if (!qNormalized) {
      return true;
    }
    return (
      row.athleteFullName.toLowerCase().includes(qNormalized) ||
      row.title.toLowerCase().includes(qNormalized)
    );
  });

  const showPriorityBlocks = statusFilter === "all";
  const priorityExpired = filteredRows.filter((r) => r.status === "EXPIRED");
  const priorityExpiring = filteredRows.filter((r) => r.status === "EXPIRING");
  // Evita duplicazioni: con filtri aperti l'elenco sotto mostra VALID + NO_EXPIRY.
  const listRows = showPriorityBlocks
    ? filteredRows.filter((r) => r.status === "VALID" || r.status === "NO_EXPIRY")
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
                  <FileText className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
                    Archivio
                  </p>
                  <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                    Documenti
                  </h1>
                  <p className="mt-1 text-sm font-medium text-sky-100">
                    {rows.length} documento{rows.length === 1 ? "" : "i"} in archivio metadati
                  </p>
                </div>
              </div>
              <Link
                href="/admin/documenti/nuovo"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-blue-900 shadow-sm transition hover:bg-sky-50"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Nuovo documento
              </Link>
            </div>
          </div>
        </header>

        <AdminBackLink />

        <p className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3 text-sm text-zinc-600">
          Questa pagina gestisce l&apos;<span className="font-semibold text-blue-950">archivio Document</span>{" "}
          (metadati e percorso testuale). I file reali di iscrizione sono nella scheda atleta; i
          certificati medici nella sezione Visite mediche. Nessun download fittizio qui.
        </p>

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
          </article>
          <article className="rounded-3xl border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-red-800/80">
              Scaduti
            </p>
            <p className="mt-2 text-2xl font-black text-red-950">{expiredCount}</p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
              Senza scadenza
            </p>
            <p className="mt-2 text-2xl font-black text-slate-900">{noExpiryCount}</p>
          </article>
        </section>

        <p className="text-xs font-medium text-zinc-500">
          KPI calcolati sui {rows.length} documenti caricati in questa pagina. Stati da data di
          scadenza registrata, non da obblighi inventati.
        </p>

        <section className="rounded-3xl border border-sky-100 bg-white/95 p-4 shadow-sm sm:p-5">
          <form method="get" className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">Cerca atleta o titolo</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-400"
                aria-hidden
              />
              <input
                name="q"
                defaultValue={q}
                placeholder="Cerca atleta o titolo"
                className="min-h-12 w-full rounded-2xl border border-sky-200 bg-sky-50/50 py-2.5 pl-10 pr-3 text-sm font-medium text-blue-950 outline-none ring-blue-500 placeholder:text-zinc-400 focus:bg-white focus:ring-2"
              />
            </label>
            <select
              name="status"
              defaultValue={statusFilter === "all" ? "" : statusFilter}
              aria-label="Filtro stato documento"
              className="min-h-12 rounded-2xl border border-sky-200 bg-white px-3 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            >
              <option value="">Tutti gli stati</option>
              <option value="EXPIRED">Scaduti</option>
              <option value="EXPIRING">In scadenza</option>
              <option value="VALID">Validi</option>
              <option value="NO_EXPIRY">Senza scadenza</option>
            </select>
            <select
              name="type"
              defaultValue={typeFilter}
              aria-label="Filtro tipologia"
              className="min-h-12 rounded-2xl border border-sky-200 bg-white px-3 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            >
              <option value="">Tutte le tipologie</option>
              {DOCUMENT_TYPE_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
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
              {q || statusFilter !== "all" || typeFilter ? (
                <Link
                  href="/admin/documenti"
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
              empty="Nessun documento scaduto con i filtri attuali."
              rows={priorityExpired}
              tone="bad"
            />
            <PrioritySection
              title={`In scadenza (${priorityExpiring.length})`}
              empty="Nessun documento in scadenza con i filtri attuali."
              rows={priorityExpiring}
              tone="warn"
            />
          </>
        ) : null}

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-blue-950">
            {showPriorityBlocks
              ? `Validi e senza scadenza (${listRows.length})`
              : `Elenco filtrato (${listRows.length})`}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {showPriorityBlocks
              ? "Scaduti e in scadenza sono nelle sezioni sopra, senza duplicazioni."
              : "Risultati in base a ricerca e filtri."}
          </p>

          {listRows.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-4 py-8 text-center text-sm text-zinc-600">
              {rows.length === 0
                ? "Nessun documento in archivio. Usa «Nuovo documento» per aggiungere metadati."
                : "Nessun risultato con i filtri selezionati."}
            </p>
          ) : (
            <>
              <ul className="mt-4 grid gap-3 md:hidden">
                {listRows.map((row) => (
                  <DocumentCard key={row.id} row={row} />
                ))}
              </ul>
              <div className="mt-4 hidden overflow-hidden rounded-2xl border border-sky-100 md:block">
                <DocumentTable rows={listRows} />
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
  rows: DocumentRow[];
  tone: "bad" | "warn";
}) {
  return (
    <section
      className={`rounded-3xl border bg-white p-4 shadow-sm sm:p-5 ${
        tone === "bad" ? "border-red-200" : "border-amber-200"
      }`}
    >
      <h2 className="text-base font-black text-blue-950">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-4 py-4 text-sm text-zinc-600">
          {empty}
        </p>
      ) : (
        <>
          <ul className="mt-3 grid gap-3 md:hidden">
            {rows.map((row) => (
              <DocumentCard key={`prio-${row.id}`} row={row} />
            ))}
          </ul>
          <div className="mt-3 hidden overflow-hidden rounded-2xl border border-sky-100 md:block">
            <DocumentTable rows={rows} />
          </div>
        </>
      )}
    </section>
  );
}

function DocumentTable({ rows }: { rows: DocumentRow[] }) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-sky-100 bg-sky-50/50 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
          <th className="px-4 py-3">Atleta</th>
          <th className="px-4 py-3">Tipo</th>
          <th className="px-4 py-3">Titolo</th>
          <th className="px-4 py-3">Scadenza</th>
          <th className="px-4 py-3">Stato</th>
          <th className="px-4 py-3">Azioni</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className="border-b border-sky-50 align-top last:border-0 hover:bg-sky-50/40"
          >
            <td className="px-4 py-3">
              <Link
                href={`/admin/atleti/${row.athleteId}`}
                className="font-bold text-blue-900 hover:underline"
              >
                {row.athleteFullName}
              </Link>
            </td>
            <td className="px-4 py-3 text-zinc-700">
              {DOCUMENT_TYPE_LABEL[row.type] ?? row.type}
            </td>
            <td className="px-4 py-3 font-medium text-blue-950">{row.title}</td>
            <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
              {row.expiryDate ? dateFormatter.format(new Date(row.expiryDate)) : "—"}
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={row.status} />
            </td>
            <td className="px-4 py-3">
              <Link
                href={`/admin/documenti/${row.id}/modifica`}
                className="inline-flex min-h-10 items-center rounded-xl border border-blue-200 bg-white px-3 text-xs font-bold text-blue-800 hover:bg-blue-50"
              >
                Modifica
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DocumentCard({ row }: { row: DocumentRow }) {
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
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {DOCUMENT_TYPE_LABEL[row.type] ?? row.type}
          </p>
        </div>
        <StatusBadge status={row.status} />
      </div>
      <p className="mt-3 text-sm font-semibold text-blue-950">{row.title}</p>
      <p className="mt-1 text-xs text-zinc-500">
        Scadenza: {row.expiryDate ? dateFormatter.format(new Date(row.expiryDate)) : "nessuna"}
      </p>
      <Link
        href={`/admin/documenti/${row.id}/modifica`}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-blue-800"
      >
        Modifica
      </Link>
    </li>
  );
}
