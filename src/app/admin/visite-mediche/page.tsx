import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { StatusBadge } from "@/components/layout/status-badge";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { computeMedicalVisitStatus } from "@/lib/expiry-status";
import type { MedicalVisitStatus } from "@prisma/client";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type VisitRow = {
  athleteId: string;
  athleteFullName: string;
  visitId: string | null;
  visitDate: Date | null;
  expiryDate: Date | null;
  status: MedicalVisitStatus | null;
  notes: string | null;
  certificateFilePath: string | null;
};

export default async function AdminMedicalVisitsPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/visite-mediche");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const now = new Date();

  const athletes = await prisma.athlete.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
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
  });

  const rows: VisitRow[] = athletes.map((athlete) => {
    const latest = athlete.medicalVisits[0] ?? null;
    if (!latest) {
      return {
        athleteId: athlete.id,
        athleteFullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
        visitId: null,
        visitDate: null,
        expiryDate: null,
        status: null,
        notes: null,
        certificateFilePath: null,
      };
    }

    const status = computeMedicalVisitStatus(latest.expiryDate, now);

    return {
      athleteId: athlete.id,
      athleteFullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
      visitId: latest.id,
      visitDate: latest.visitDate,
      expiryDate: latest.expiryDate,
      status,
      notes: latest.notes ?? null,
      certificateFilePath: latest.certificateFilePath ?? null,
    };
  });

  const expiring = rows.filter((r) => r.status === "EXPIRING");
  const expired = rows.filter((r) => r.status === "EXPIRED");

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Visite mediche (Admin)"
          subtitle="Stato e scadenze"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-600">Gestisci data visita, scadenza e certificati (per ora come testo).</p>
          <Link
            href="/admin/visite-mediche/nuovo"
            className="inline-flex w-fit items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Nuova visita
          </Link>
        </div>

        <section className="space-y-4">
          <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Visite in scadenza</h2>
            <p className="mt-1 text-sm text-zinc-600">Stato calcolato: meno di 30 giorni dalla scadenza.</p>
            {expiring.length === 0 ? (
              <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                Nessuna visita in scadenza.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-blue-100 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                      <th className="px-3 py-2 font-semibold">Atleta</th>
                      <th className="px-3 py-2 font-semibold">Data visita</th>
                      <th className="px-3 py-2 font-semibold">Scadenza</th>
                      <th className="px-3 py-2 font-semibold">Stato</th>
                      <th className="px-3 py-2 font-semibold">Note</th>
                      <th className="px-3 py-2 font-semibold">Certificato</th>
                      <th className="px-3 py-2 font-semibold">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50 text-zinc-700">
                    {expiring.map((row) => (
                      <tr key={row.athleteId}>
                        <td className="px-3 py-2 font-medium text-zinc-900">{row.athleteFullName}</td>
                        <td className="px-3 py-2">
                          {row.visitDate ? dateFormatter.format(new Date(row.visitDate)) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.expiryDate ? dateFormatter.format(new Date(row.expiryDate)) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.status ? <StatusBadge status={row.status} /> : null}
                        </td>
                        <td className="px-3 py-2">{row.notes || "-"}</td>
                        <td className="px-3 py-2">
                          {row.certificateFilePath ? "Presente" : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.visitId ? (
                            <Link
                              href={`/admin/visite-mediche/${row.visitId}/modifica`}
                              className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Modifica
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Visite scadute</h2>
            <p className="mt-1 text-sm text-zinc-600">Stato calcolato: scadenza passata.</p>
            {expired.length === 0 ? (
              <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                Nessuna visita scaduta.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-blue-100 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                      <th className="px-3 py-2 font-semibold">Atleta</th>
                      <th className="px-3 py-2 font-semibold">Data visita</th>
                      <th className="px-3 py-2 font-semibold">Scadenza</th>
                      <th className="px-3 py-2 font-semibold">Stato</th>
                      <th className="px-3 py-2 font-semibold">Note</th>
                      <th className="px-3 py-2 font-semibold">Certificato</th>
                      <th className="px-3 py-2 font-semibold">Azioni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50 text-zinc-700">
                    {expired.map((row) => (
                      <tr key={row.athleteId}>
                        <td className="px-3 py-2 font-medium text-zinc-900">{row.athleteFullName}</td>
                        <td className="px-3 py-2">
                          {row.visitDate ? dateFormatter.format(new Date(row.visitDate)) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.expiryDate ? dateFormatter.format(new Date(row.expiryDate)) : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.status ? <StatusBadge status={row.status} /> : null}
                        </td>
                        <td className="px-3 py-2">{row.notes || "-"}</td>
                        <td className="px-3 py-2">
                          {row.certificateFilePath ? "Presente" : "-"}
                        </td>
                        <td className="px-3 py-2">
                          {row.visitId ? (
                            <Link
                              href={`/admin/visite-mediche/${row.visitId}/modifica`}
                              className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Modifica
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Ultima visita per atleta</h2>
            <p className="mt-1 text-sm text-zinc-600">Mostro solo l&apos;ultima visita registrata per atleta.</p>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Atleta</th>
                    <th className="px-3 py-2 font-semibold">Data visita</th>
                    <th className="px-3 py-2 font-semibold">Scadenza</th>
                    <th className="px-3 py-2 font-semibold">Stato</th>
                    <th className="px-3 py-2 font-semibold">Note</th>
                    <th className="px-3 py-2 font-semibold">Certificato</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {rows.map((row) => (
                    <tr key={row.athleteId}>
                      <td className="px-3 py-2 font-medium text-zinc-900">{row.athleteFullName}</td>
                      <td className="px-3 py-2">
                        {row.visitDate ? dateFormatter.format(new Date(row.visitDate)) : "-"}
                      </td>
                      <td className="px-3 py-2">
                        {row.expiryDate ? dateFormatter.format(new Date(row.expiryDate)) : "-"}
                      </td>
                      <td className="px-3 py-2">
                        {row.status ? (
                          <StatusBadge status={row.status} />
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-semibold text-zinc-700">
                            Nessuna visita
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{row.notes || "-"}</td>
                      <td className="px-3 py-2">
                        {row.certificateFilePath ? "Presente" : "-"}
                      </td>
                      <td className="px-3 py-2">
                        {row.visitId ? (
                          <Link
                            href={`/admin/visite-mediche/${row.visitId}/modifica`}
                            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                          >
                            Modifica
                          </Link>
                        ) : (
                          <Link
                            href={`/admin/visite-mediche/nuovo?athleteId=${row.athleteId}`}
                            className="inline-flex items-center rounded-md border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            Inserisci
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

