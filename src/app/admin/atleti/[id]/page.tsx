import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  FileText,
  HeartPulse,
  MapPin,
  UserRound,
  Users,
} from "lucide-react";
import { StatusBadge } from "@/components/layout/status-badge";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { computeMedicalVisitStatus } from "@/lib/expiry-status";
import { AthleteDeleteButton } from "@/components/admin/athlete-delete-button";
import { AthleteEnrollmentDocuments } from "@/components/admin/athlete-enrollment-documents";
import { AthleteReactivateButton } from "@/components/admin/athlete-reactivate-button";
import { AthleteWithdrawButton } from "@/components/admin/athlete-withdraw-button";
import { ChangeAthleteCategoryInline } from "@/components/admin/change-athlete-category-inline";
import { assessAthleteFinancialDeletability } from "@/lib/admin-athlete-delete";
import {
  ATHLETE_ROSTER_STATUS_LABEL,
  isAthleteActive,
} from "@/lib/athlete-roster-status";
import { DOCUMENT_TYPE_LABEL } from "@/lib/document-types";
import { assertCanAccessAthleteData } from "@/lib/youth-director-data-access";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type AdminAthleteDetailPageProps = {
  params: Promise<{ id: string }>;
};

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <div className="mt-1 text-sm font-semibold text-blue-950">{value}</div>
    </div>
  );
}

export default async function AdminAthleteDetailPage({ params }: AdminAthleteDetailPageProps) {
  const { id } = await params;

  const session = await getAuthSession();
  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/atleti/${id}`);
  }

  const canManageAthleteCategory = session.user.role === "ADMIN";
  if (!canManageAthleteCategory && session.user.role !== "YOUTH_DIRECTOR") {
    redirect("/unauthorized");
  }

  const athleteAccess = await assertCanAccessAthleteData({
    userId: session.user.id,
    role: session.user.role,
    athleteId: id,
  });
  if (!athleteAccess.ok) {
    redirect("/unauthorized");
  }

  const [athlete, activeCategories] = await Promise.all([
    prisma.athlete.findUnique({
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
        rosterStatus: true,
        withdrawnAt: true,
        withdrawReason: true,
        parent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            taxCode: true,
            phone: true,
            city: true,
            province: true,
          },
        },
        additionalParents: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            parent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                taxCode: true,
                phone: true,
                city: true,
                province: true,
              },
            },
          },
        },
        category: {
          select: {
            id: true,
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
        enrollments: {
          orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
          select: {
            documents: {
              select: {
                id: true,
                type: true,
                fileName: true,
              },
            },
            payments: {
              select: {
                id: true,
                status: true,
                paidAt: true,
                receipt: { select: { id: true } },
                accountingEntry: { select: { id: true } },
              },
            },
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
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ seasonLabel: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        seasonLabel: true,
        birthYearsLabel: true,
      },
    }),
  ]);

  if (!athlete) {
    redirect("/admin/atleti");
  }

  const now = new Date();
  const latestEnrollmentDocuments = athlete.enrollments[0]?.documents ?? [];
  const payments = athlete.enrollments.flatMap((enrollment) => enrollment.payments);
  const financialAssessment = assessAthleteFinancialDeletability(payments);
  const hasPaidEvidence = !financialAssessment.ok;
  const isActive = isAthleteActive(athlete.rosterStatus);
  const initials = `${athlete.firstName.charAt(0)}${athlete.lastName.charAt(0)}`.toUpperCase();

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 md:gap-5">
        <Link
          href="/admin/atleti"
          className="inline-flex w-fit min-h-11 items-center gap-2 rounded-xl border border-sky-200 bg-white px-3 text-sm font-bold text-blue-800 shadow-sm hover:bg-sky-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Torna alla lista
        </Link>

        <header className="overflow-hidden rounded-3xl border border-blue-800/30 bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 text-white shadow-lg shadow-blue-950/15">
          <div className="relative p-5 sm:p-6">
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-sky-400/20 blur-2xl"
              aria-hidden
            />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo-home.png"
                  alt="ASD Comun Nuovo"
                  className="hidden h-16 w-16 shrink-0 rounded-2xl bg-white object-contain p-1 shadow-md sm:block"
                />
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white text-lg font-black text-blue-950 shadow-md sm:hidden"
                  aria-hidden
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
                    Scheda atleta · ASD Comun Nuovo
                  </p>
                  <h1 className="mt-1 truncate text-2xl font-black tracking-tight sm:text-3xl">
                    {athlete.firstName} {athlete.lastName}
                  </h1>
                  <p className="mt-2 text-sm font-medium text-sky-100">
                    {athlete.category.name} · {athlete.category.seasonLabel}
                  </p>
                  <p className="mt-0.5 text-xs text-sky-200/90">
                    {athlete.category.birthYearsLabel} · Nato{" "}
                    {dateFormatter.format(new Date(athlete.birthDate))}
                    {athlete.birthPlace ? ` · ${athlete.birthPlace}` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        isActive
                          ? "bg-white/20 text-white ring-1 ring-white/30"
                          : "bg-slate-900/30 text-sky-50 ring-1 ring-white/20"
                      }`}
                    >
                      {ATHLETE_ROSTER_STATUS_LABEL[athlete.rosterStatus]}
                    </span>
                    <span className="inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-100 ring-1 ring-white/20">
                      {athlete.gender}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {!isActive ? (
          <section className="rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm">
            <p className="font-bold">Atleta ritirato dalla rosa attiva</p>
            {athlete.withdrawnAt ? (
              <p className="mt-1">
                Data ritiro: {dateFormatter.format(new Date(athlete.withdrawnAt))}
              </p>
            ) : null}
            {athlete.withdrawReason ? (
              <p className="mt-1">Motivo: {athlete.withdrawReason}</p>
            ) : null}
            <p className="mt-1 text-slate-600">
              Storico pagamenti, ricevute e documenti resta accessibile.
            </p>
          </section>
        ) : null}

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserRound className="h-5 w-5 text-blue-700" aria-hidden />
            <h2 className="text-base font-black text-blue-950">Dati anagrafici</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Categoria"
              value={
                <>
                  {athlete.category.name} ({athlete.category.seasonLabel})
                  <span className="mt-0.5 block text-xs font-medium text-zinc-500">
                    {athlete.category.birthYearsLabel}
                  </span>
                </>
              }
            />
            <Field
              label="Data di nascita"
              value={dateFormatter.format(new Date(athlete.birthDate))}
            />
            <Field label="Luogo di nascita" value={athlete.birthPlace} />
            <Field label="Genere" value={athlete.gender} />
            <Field label="Nazionalità" value={athlete.nationality} />
            <Field label="Codice fiscale" value={athlete.taxCode} />
            <Field
              label="Indirizzo"
              value={
                <>
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
                    <span>
                      {athlete.address}, {athlete.postalCode} {athlete.city}
                      <span className="mt-0.5 block text-xs font-medium text-zinc-500">
                        {athlete.province}
                      </span>
                    </span>
                  </span>
                </>
              }
            />
            {athlete.clothingSize ? (
              <Field label="Taglia" value={athlete.clothingSize} />
            ) : null}
          </div>

          {canManageAthleteCategory ? (
            <div className="mt-5 border-t border-sky-100 pt-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800">
                Cambio categoria
              </p>
              <ChangeAthleteCategoryInline
                athleteId={athlete.id}
                currentCategoryId={athlete.category.id}
                categories={activeCategories}
              />
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-700" aria-hidden />
            <h2 className="text-base font-black text-blue-950">Genitori e contatti</h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800">
                Genitore principale
              </p>
              <p className="mt-2 text-sm font-black text-blue-950">
                {athlete.parent.firstName} {athlete.parent.lastName}
              </p>
              <p className="mt-1 text-xs text-zinc-600">{athlete.parent.taxCode}</p>
              <p className="mt-1 text-sm font-semibold text-blue-900">{athlete.parent.phone}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {athlete.parent.city} ({athlete.parent.province})
              </p>
            </li>
            {athlete.additionalParents.map((link) => (
              <li
                key={link.id}
                className="rounded-2xl border border-sky-100 bg-white p-4 ring-1 ring-sky-50"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-sky-800">
                  Genitore aggiuntivo
                </p>
                <p className="mt-2 text-sm font-black text-blue-950">
                  {link.parent.firstName} {link.parent.lastName}
                </p>
                <p className="mt-1 text-xs text-zinc-600">{link.parent.taxCode}</p>
                <p className="mt-1 text-sm font-semibold text-blue-900">{link.parent.phone}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {link.parent.city} ({link.parent.province})
                </p>
              </li>
            ))}
          </ul>
          {athlete.additionalParents.length === 0 ? (
            <p className="mt-3 text-xs font-medium text-zinc-500">
              Nessun genitore aggiuntivo associato.
            </p>
          ) : null}
        </section>

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-1 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-700" aria-hidden />
            <h2 className="text-base font-black text-blue-950">Documenti iscrizione</h2>
          </div>
          <p className="mb-4 text-sm text-zinc-600">
            Allegati caricati dal genitore durante l&apos;iscrizione.
          </p>
          <AthleteEnrollmentDocuments documents={latestEnrollmentDocuments} />

          {athlete.documents.length > 0 ? (
            <div className="mt-6 border-t border-sky-100 pt-4">
              <h3 className="text-sm font-black text-blue-950">Altri documenti in archivio</h3>
              <ul className="mt-3 grid gap-2 md:hidden">
                {athlete.documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-3 text-sm"
                  >
                    <p className="font-bold text-blue-950">
                      {DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Scadenza:{" "}
                      {doc.expiryDate ? dateFormatter.format(new Date(doc.expiryDate)) : "—"}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-3 hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-sky-100 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
                      <th className="px-3 py-2">Tipo</th>
                      <th className="px-3 py-2">Scadenza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {athlete.documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-sky-50 last:border-0">
                        <td className="px-3 py-2.5 font-semibold text-blue-950">
                          {DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600">
                          {doc.expiryDate ? dateFormatter.format(new Date(doc.expiryDate)) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-blue-700" aria-hidden />
              <h2 className="text-base font-black text-blue-950">Visite mediche</h2>
            </div>
            <Link
              href={`/admin/visite-mediche/nuovo?athleteId=${athlete.id}`}
              className="inline-flex min-h-11 w-fit items-center rounded-xl bg-blue-800 px-4 text-sm font-bold text-white transition hover:bg-blue-900"
            >
              Nuova visita medica
            </Link>
          </div>

          {athlete.medicalVisits.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-4 py-3 text-sm text-zinc-700">
              Nessuna visita medica registrata.
            </p>
          ) : (
            <>
              <ul className="mt-4 grid gap-3 md:hidden">
                {athlete.medicalVisits.map((visit) => {
                  const status = computeMedicalVisitStatus(visit.expiryDate, now);
                  return (
                    <li
                      key={visit.id}
                      className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-blue-950">
                            Visita {dateFormatter.format(new Date(visit.visitDate))}
                          </p>
                          <p className="mt-1 text-xs text-zinc-600">
                            Scade {dateFormatter.format(new Date(visit.expiryDate))}
                          </p>
                        </div>
                        <StatusBadge status={status} />
                      </div>
                      <Link
                        href={`/admin/visite-mediche/${visit.id}/modifica`}
                        className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-blue-200 bg-white px-3 text-xs font-bold text-blue-800 hover:bg-blue-50"
                      >
                        Modifica
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-sky-100 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
                      <th className="px-3 py-2">Data visita</th>
                      <th className="px-3 py-2">Scadenza</th>
                      <th className="px-3 py-2">Stato</th>
                      <th className="px-3 py-2">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {athlete.medicalVisits.map((visit) => {
                      const status = computeMedicalVisitStatus(visit.expiryDate, now);
                      return (
                        <tr key={visit.id} className="border-b border-sky-50 last:border-0">
                          <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-blue-950">
                            {dateFormatter.format(new Date(visit.visitDate))}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600">
                            {dateFormatter.format(new Date(visit.expiryDate))}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge status={status} />
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <Link
                              href={`/admin/visite-mediche/${visit.id}/modifica`}
                              className="inline-flex min-h-10 items-center rounded-xl border border-blue-200 bg-white px-3 text-xs font-bold text-blue-800 hover:bg-blue-50"
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
            </>
          )}
        </section>

        {canManageAthleteCategory ? (
          <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-black text-blue-950">Stato rosa</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Il ritiro esclude l&apos;atleta dalle rose operative senza cancellare lo storico
              economico. L&apos;eliminazione definitiva resta bloccata se ci sono pagamenti o
              movimenti contabili.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {isActive ? (
                <AthleteWithdrawButton
                  athleteId={athlete.id}
                  firstName={athlete.firstName}
                  lastName={athlete.lastName}
                  hasPaidEvidence={hasPaidEvidence}
                />
              ) : (
                <AthleteReactivateButton
                  athleteId={athlete.id}
                  firstName={athlete.firstName}
                  lastName={athlete.lastName}
                />
              )}
            </div>
          </section>
        ) : null}

        {canManageAthleteCategory ? (
          <section className="rounded-3xl border border-red-200 bg-red-50/70 p-4 shadow-sm sm:p-5">
            <h2 className="text-base font-black text-red-800">Zona pericolo</h2>
            <p className="mt-1 text-sm text-red-700">
              Elimina definitivamente questo atleta e i dati collegati (iscrizione, pagamenti non
              saldati, documenti, convocazioni). Genitore, account utente e categoria non vengono
              eliminati. Operazione irreversibile e bloccata se esistono pagamenti o movimenti
              contabili reali.
            </p>
            <p className="mt-2 text-xs text-red-600/90">
              ID atleta (verifica prima di eliminare):{" "}
              <span className="font-mono font-semibold">{athlete.id}</span>
            </p>
            <div className="mt-4">
              <AthleteDeleteButton
                athleteId={athlete.id}
                firstName={athlete.firstName}
                lastName={athlete.lastName}
                categoryName={athlete.category.name}
                categorySeasonLabel={athlete.category.seasonLabel}
              />
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
