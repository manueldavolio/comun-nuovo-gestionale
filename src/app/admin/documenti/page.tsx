import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { StatusBadge } from "@/components/layout/status-badge";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { computeExpiryBadgeStatus } from "@/lib/expiry-status";
import { DOCUMENT_TYPE_LABEL } from "@/lib/document-types";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function AdminAthleteDocumentsPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/documenti");
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
      documents: {
        orderBy: { createdAt: "desc" },
        select: { id: true, type: true, title: true, expiryDate: true },
      },
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Documenti atleta (Admin)"
          subtitle="Scadenze e stato"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-zinc-600">
            Visualizza, per ogni atleta, i documenti caricati con tipo e stato calcolato dalla scadenza.
          </p>
          <Link
            href="/admin/documenti/nuovo"
            className="inline-flex w-fit items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Nuovo documento
          </Link>
        </div>

        {athletes.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
            Nessun atleta presente.
          </p>
        ) : (
          <section className="space-y-4">
            {athletes.map((athlete) => (
              <article
                key={athlete.id}
                className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900">
                      {athlete.firstName} {athlete.lastName}
                    </h2>
                    <p className="text-sm text-zinc-600">Documenti caricati</p>
                  </div>
                  <p className="text-xs text-zinc-500">{athlete.documents.length} documento/i</p>
                </div>

                {athlete.documents.length === 0 ? (
                  <p className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                    Nessun documento disponibile.
                  </p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-blue-100 text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                          <th className="px-3 py-2 font-semibold">Tipo</th>
                          <th className="px-3 py-2 font-semibold">Titolo</th>
                          <th className="px-3 py-2 font-semibold">Scadenza</th>
                          <th className="px-3 py-2 font-semibold">Stato</th>
                          <th className="px-3 py-2 font-semibold">Azioni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-50 text-zinc-700">
                        {athlete.documents.map((doc) => {
                          const status = computeExpiryBadgeStatus(doc.expiryDate, now);
                          return (
                            <tr key={doc.id}>
                              <td className="px-3 py-2">
                                {DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type}
                              </td>
                              <td className="px-3 py-2">{doc.title}</td>
                              <td className="px-3 py-2">
                                {doc.expiryDate ? dateFormatter.format(new Date(doc.expiryDate)) : "-"}
                              </td>
                              <td className="px-3 py-2">
                                <StatusBadge status={status} />
                              </td>
                              <td className="px-3 py-2">
                                <Link
                                  href={`/admin/documenti/${doc.id}/modifica`}
                                  className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                                >
                                  Modifica
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

