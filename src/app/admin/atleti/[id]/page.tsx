import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { StatusBadge } from "@/components/layout/status-badge";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { computeMedicalVisitStatus } from "@/lib/expiry-status";
import { DOCUMENT_TYPE_LABEL } from "@/lib/document-types";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type AdminAthleteDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminAthleteDetailPage({ params }: AdminAthleteDetailPageProps) {
  const { id } = await params;

  const session = await getAuthSession();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/atleti/${id}`);
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const athlete = await prisma.athlete.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      birthDate: true,
      birthPlace: true,
      taxCode: true,
      nationality: true,
      address: true,
      city: true,
      postalCode: true,
      province: true,
      clothingSize: true,
      medicalNotes: true,
      parent: {
        select: {
          firstName: true,
          lastName: true,
          taxCode: true,
          phone: true,
          city: true,
          province: true,
        },
      },
      category: {
        select: {
          name: true,
          birthYearsLabel: true,
          seasonLabel: true,
        },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          type: true,
          expiryDate: true,
        },
      },
      medicalVisits: {
        orderBy: { visitDate: "desc" },
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

  if (!athlete) {
    redirect("/admin/atleti");
  }

  const now = new Date();

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title={`${athlete.firstName} ${athlete.lastName}`}
          subtitle="Anagrafica, documenti e visite mediche"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <Link
            href="/admin/atleti"
            className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna alla lista
          </Link>
        </div>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Dati anagrafici</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-900">Categoria</p>
              <p className="text-sm text-zinc-700">
                {athlete.category.name} ({athlete.category.seasonLabel})
              </p>
              <p className="text-xs text-zinc-500">
                {athlete.category.birthYearsLabel}
              </p>

              <div className="mt-4 border-t border-blue-100 pt-4">
                <p className="text-sm font-medium text-zinc-900">Nascita</p>
                <p className="text-sm text-zinc-700">
                  {dateFormatter.format(new Date(athlete.birthDate))}
                </p>
                <p className="text-xs text-zinc-500">{athlete.birthPlace}</p>

                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Genere</p>
                  <p className="text-sm text-zinc-700">{athlete.gender}</p>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Nazionalita</p>
                  <p className="text-sm text-zinc-700">{athlete.nationality}</p>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Codice fiscale</p>
                  <p className="text-sm text-zinc-700">{athlete.taxCode}</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-900">Genitore collegato</p>
              <p className="text-sm text-zinc-700">
                {athlete.parent.firstName} {athlete.parent.lastName}
              </p>
              <p className="text-xs text-zinc-500">
                {athlete.parent.taxCode} - {athlete.parent.phone}
              </p>
              <p className="text-xs text-zinc-500">
                {athlete.parent.city} ({athlete.parent.province})
              </p>

              <div className="mt-4 border-t border-blue-100 pt-4">
                <p className="text-sm font-medium text-zinc-900">Indirizzo</p>
                <p className="text-sm text-zinc-700">
                  {athlete.address}, {athlete.postalCode} {athlete.city}
                </p>
                <p className="text-xs text-zinc-500">{athlete.province}</p>

                {athlete.clothingSize ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Taglia</p>
                    <p className="text-sm text-zinc-700">{athlete.clothingSize}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Documenti</h2>
          </div>

          {athlete.documents.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Nessun documento disponibile.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Tipo</th>
                    <th className="px-3 py-2 font-semibold">Scadenza</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {athlete.documents.map((doc) => (
                    <tr key={doc.id}>
                      <td className="px-3 py-2">
                        {DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {doc.expiryDate ? dateFormatter.format(new Date(doc.expiryDate)) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-semibold text-zinc-900">Visite mediche</h2>
            <Link
              href={`/admin/visite-mediche/nuovo?athleteId=${athlete.id}`}
              className="inline-flex w-fit items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Nuova visita medica
            </Link>
          </div>

          {athlete.medicalVisits.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Nessuna visita medica registrata.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Data visita</th>
                    <th className="px-3 py-2 font-semibold">Scadenza</th>
                    <th className="px-3 py-2 font-semibold">Stato</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {athlete.medicalVisits.map((visit) => {
                    const status = computeMedicalVisitStatus(visit.expiryDate, now);
                    return (
                      <tr key={visit.id}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {dateFormatter.format(new Date(visit.visitDate))}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {dateFormatter.format(new Date(visit.expiryDate))}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                            <StatusBadge status={status} />
                            <span className="text-xs font-medium text-zinc-500 sm:ml-2">
                              {status}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <Link
                            href={`/admin/visite-mediche/${visit.id}/modifica`}
                            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
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
        </section>
      </div>
    </main>
  );
}

