import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { DashboardCard } from "@/components/layout/dashboard-card";
import { StatusBadge } from "@/components/layout/status-badge";
import { ParentConvocations } from "@/components/convocations/parent-convocations";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { COACH_VISIBLE_EVENT_TYPES, formatEventType } from "@/lib/events";
import { computeExpiryBadgeStatus, computeMedicalVisitStatus } from "@/lib/expiry-status";
import { DOCUMENT_TYPE_LABEL } from "@/lib/document-types";

type ParentDashboardPageProps = {
  searchParams: Promise<{ enrolled?: string }>;
};

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Bozza",
  SUBMITTED: "Inviata",
  APPROVED: "Approvata",
  REJECTED: "Rifiutata",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Da pagare",
  PAID: "Pagato",
  OVERDUE: "Scaduto",
  CANCELLED: "Annullato",
};

const ENROLLMENT_STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-amber-200 bg-amber-50 text-amber-800",
  SUBMITTED: "border-amber-200 bg-amber-50 text-amber-800",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  OVERDUE: "border-red-200 bg-red-50 text-red-700",
  PAID: "border-emerald-200 bg-emerald-50 text-emerald-800",
  CANCELLED: "border-zinc-200 bg-zinc-50 text-zinc-700",
};

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function statusClass(
  palette: Record<string, string>,
  status: string | null,
  fallback: string = "border-zinc-200 bg-zinc-50 text-zinc-700",
) {
  if (!status) {
    return fallback;
  }

  return palette[status] ?? fallback;
}

export default async function ParentDashboardPage({ searchParams }: ParentDashboardPageProps) {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/genitore");
  }

  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  const params = await searchParams;
  const showEnrollmentSuccess = params.enrolled === "1";

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      athletes: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
              documents: {
                orderBy: { createdAt: "desc" },
                select: { id: true, type: true, title: true, expiryDate: true },
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
          enrollments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              seasonLabel: true,
              status: true,
              createdAt: true,
              payments: {
                select: {
                  id: true,
                  type: true,
                  status: true,
                  receipt: {
                    select: {
                      id: true,
                      filePath: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!parentProfile) {
    redirect("/unauthorized");
  }

  const now = new Date();

  const athleteRows = parentProfile.athletes.map((athlete) => {
    const latestEnrollment = athlete.enrollments[0];
    const deposit = latestEnrollment?.payments.find((payment) => payment.type === "DEPOSIT");
    const balance = latestEnrollment?.payments.find((payment) => payment.type === "BALANCE");
    const medicalVisit = athlete.medicalVisits[0] ?? null;
    const medicalVisitStatus = medicalVisit
      ? computeMedicalVisitStatus(medicalVisit.expiryDate, now)
      : null;

    return {
      id: athlete.id,
      fullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
      categoryId: athlete.category.id,
      categoryName: athlete.category.name,
      enrollmentStatus: latestEnrollment?.status ?? null,
      depositPayment: deposit ?? null,
      balancePayment: balance ?? null,
      seasonLabel: latestEnrollment?.seasonLabel ?? null,
      documents: athlete.documents,
      medicalVisit,
      medicalVisitStatus,
    };
  });

  const submittedEnrollments = athleteRows.filter((row) => row.enrollmentStatus === "SUBMITTED").length;
  const pendingPayments = athleteRows.reduce((count, row) => {
    const depositPending =
      row.depositPayment?.status === "PENDING" || row.depositPayment?.status === "OVERDUE";
    const balancePending =
      row.balancePayment?.status === "PENDING" || row.balancePayment?.status === "OVERDUE";
    return count + (depositPending ? 1 : 0) + (balancePending ? 1 : 0);
  }, 0);
  const medicalAlerts = athleteRows.reduce((count, row) => {
    if (row.medicalVisitStatus === "EXPIRING" || row.medicalVisitStatus === "EXPIRED") {
      return count + 1;
    }
    return count;
  }, 0);
  const categoryIds = Array.from(new Set(athleteRows.map((row) => row.categoryId)));
  const [categoryCalendarEvents, relevantAnnouncements, convocationEntries] = await Promise.all([
    categoryIds.length === 0
      ? Promise.resolve([])
      : prisma.event.findMany({
          where: {
            startAt: {
              gte: now,
            },
            categoryId: {
              in: categoryIds,
            },
            type: {
              in: COACH_VISIBLE_EVENT_TYPES,
            },
          },
          orderBy: [{ startAt: "asc" }],
          take: 120,
          select: {
            id: true,
            title: true,
            type: true,
            startAt: true,
            location: true,
            categoryId: true,
          },
        }),
    prisma.announcement.findMany({
      where: {
        publishedAt: {
          not: null,
          lte: now,
        },
        OR: [
          { audience: "ALL" },
          { audience: "PARENTS" },
          {
            audience: "CATEGORY_ONLY",
            categoryId: {
              in: categoryIds,
            },
          },
        ],
      },
      orderBy: [{ publishedAt: "desc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        content: true,
        audience: true,
        categoryId: true,
        publishedAt: true,
        category: {
          select: {
            name: true,
          },
        },
      },
    }),
    athleteRows.length === 0
      ? Promise.resolve([])
      : prisma.convocationAthlete.findMany({
          where: {
            athleteId: {
              in: athleteRows.map((row) => row.id),
            },
            convocation: {
              event: {
                startAt: {
                  gte: now,
                },
              },
            },
          },
          orderBy: {
            convocation: {
              event: {
                startAt: "asc",
              },
            },
          },
          select: {
            id: true,
            responseStatus: true,
            athlete: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            convocation: {
              select: {
                notes: true,
                category: {
                  select: {
                    name: true,
                  },
                },
                event: {
                  select: {
                    title: true,
                    startAt: true,
                    location: true,
                  },
                },
              },
            },
          },
        }),
  ]);

  const calendarEventsByCategory = new Map(
    categoryIds.map((categoryId) => [
      categoryId,
      categoryCalendarEvents.filter((event) => event.categoryId === categoryId).slice(0, 3),
    ]),
  );

  const communicationsByCategory = new Map(
    categoryIds.map((categoryId) => [
      categoryId,
      relevantAnnouncements
        .filter((announcement) => {
          if (announcement.audience === "ALL" || announcement.audience === "PARENTS") {
            return true;
          }
          return announcement.categoryId === categoryId;
        })
        .slice(0, 3),
    ]),
  );
  const generalCommunications = relevantAnnouncements
    .filter((announcement) => announcement.audience !== "CATEGORY_ONLY")
    .slice(0, 3);
  const parentConvocations = convocationEntries
    .filter((entry) => Boolean(entry.convocation.event))
    .map((entry) => ({
      convocationAthleteId: entry.id,
      athleteFullName: `${entry.athlete.firstName} ${entry.athlete.lastName}`.trim(),
      categoryName: entry.convocation.category.name,
      eventTitle: entry.convocation.event!.title,
      eventStartAtLabel: dateTimeFormatter.format(new Date(entry.convocation.event!.startAt)),
      eventLocation: entry.convocation.event!.location,
      notes: entry.convocation.notes,
      responseStatus: entry.responseStatus,
    }));
  const pendingConvocations = parentConvocations.filter(
    (entry) => entry.responseStatus === "PENDING",
  ).length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Area Genitore"
          subtitle="Dashboard famiglia: iscrizioni, scadenze e comunicazioni"
          userName={session.user.name ?? "Genitore"}
        />

        {showEnrollmentSuccess && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm">
            Iscrizione inviata correttamente. Le scadenze economiche sono state generate.
          </p>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardCard
            title="Figli iscritti"
            value={athleteRows.length}
            description="Atleti collegati al tuo profilo"
          />
          <DashboardCard
            title="Stato iscrizione"
            value={submittedEnrollments}
            description="Iscrizioni inviate in attesa di gestione"
          />
          <DashboardCard
            title="Pagamenti"
            value={pendingPayments}
            description="Scadenze aperte tra acconto e saldo"
          />
          <DashboardCard
            title="Visite da controllare"
            value={medicalAlerts}
            description="Visite mediche in scadenza o scadute"
          />
          <DashboardCard
            title="Convocazioni"
            value={pendingConvocations}
            description="Risposte presenza/assenza in attesa"
          />
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Dashboard figli</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Visualizzi solo dati collegati al tuo account genitore.
              </p>
            </div>
            <Link
              href="/genitore/iscrizione/nuova"
              className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Nuova iscrizione
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/genitore/media"
              className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
            >
              Apri media categoria
            </Link>
          </div>

          <section className="mt-4 rounded-lg border border-blue-100 bg-slate-50 p-3">
            <h4 className="text-sm font-semibold text-zinc-900">Comunicazioni generali famiglia</h4>
            {generalCommunications.length === 0 ? (
              <p className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                Nessuna comunicazione generale recente.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {generalCommunications.map((announcement) => (
                  <li key={announcement.id} className="rounded-lg border border-blue-100 bg-white p-3">
                    <p className="text-sm font-semibold text-zinc-900">{announcement.title}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {announcement.publishedAt ? dateFormatter.format(new Date(announcement.publishedAt)) : "-"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-700">
                      {announcement.content.length > 180
                        ? `${announcement.content.slice(0, 180)}...`
                        : announcement.content}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-4 rounded-lg border border-blue-100 bg-slate-50 p-3">
            <h4 className="text-sm font-semibold text-zinc-900">Convocazioni ricevute</h4>
            <p className="mt-1 text-xs text-zinc-600">
              Per ogni atleta conferma rapidamente presenza o assenza.
            </p>
            <ParentConvocations items={parentConvocations} />
          </section>

          {athleteRows.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
              Nessun figlio iscritto al momento. Usa il pulsante “Nuova iscrizione” per iniziare.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {athleteRows.map((row) => {
                const childEvents = calendarEventsByCategory.get(row.categoryId) ?? [];
                const childCommunications = communicationsByCategory.get(row.categoryId) ?? [];

                return (
                  <article key={row.id} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-blue-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-zinc-900">{row.fullName}</h3>
                        <p className="text-sm text-zinc-600">{row.categoryName}</p>
                      </div>
                      <span
                        className={[
                          "inline-flex w-fit items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                          statusClass(ENROLLMENT_STATUS_COLORS, row.enrollmentStatus),
                        ].join(" ")}
                      >
                        Iscrizione:{" "}
                        {row.enrollmentStatus
                          ? ENROLLMENT_STATUS_LABEL[row.enrollmentStatus] ?? row.enrollmentStatus
                          : "Non disponibile"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <section className="rounded-lg border border-blue-100 bg-slate-50 p-3">
                        <h4 className="text-sm font-semibold text-zinc-900">Sezione anagrafica</h4>
                        <dl className="mt-2 space-y-1 text-sm text-zinc-700">
                          <div className="flex items-center justify-between gap-2">
                            <dt>Nome e cognome</dt>
                            <dd className="font-medium text-zinc-900">{row.fullName}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt>Categoria</dt>
                            <dd className="font-medium text-zinc-900">{row.categoryName}</dd>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <dt>Stagione</dt>
                            <dd className="font-medium text-zinc-900">{row.seasonLabel ?? "-"}</dd>
                          </div>
                        </dl>
                      </section>

                      <section className="rounded-lg border border-blue-100 bg-slate-50 p-3">
                        <h4 className="text-sm font-semibold text-zinc-900">Sezione pagamenti</h4>
                        <div className="mt-2 space-y-3">
                          {[
                            { label: "Acconto", payment: row.depositPayment },
                            { label: "Saldo", payment: row.balancePayment },
                          ].map(({ label, payment }) => (
                            <div key={label} className="rounded-lg border border-blue-100 bg-white p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-zinc-900">{label}</p>
                                <span
                                  className={[
                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                                    statusClass(PAYMENT_STATUS_COLORS, payment?.status ?? null),
                                  ].join(" ")}
                                >
                                  {payment
                                    ? PAYMENT_STATUS_LABEL[payment.status] ?? payment.status
                                    : "Non generato"}
                                </span>
                              </div>
                              <div className="mt-2">
                                {payment?.receipt?.filePath ? (
                                  <a
                                    href={`/api/genitore/receipts/${payment.receipt.id}/download`}
                                    className="inline-flex rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                                  >
                                    Scarica ricevuta
                                  </a>
                                ) : (
                                  <p className="text-xs text-zinc-500">Ricevuta non disponibile</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <section className="rounded-lg border border-blue-100 bg-slate-50 p-3">
                        <h4 className="text-sm font-semibold text-zinc-900">Sezione visita medica</h4>
                        {row.medicalVisit ? (
                          <div className="mt-2 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={row.medicalVisitStatus ?? "EXPIRED"} />
                              <span
                                className={[
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                                  statusClass(
                                    {
                                      VALID: "border-emerald-200 bg-emerald-50 text-emerald-800",
                                      EXPIRING: "border-amber-200 bg-amber-50 text-amber-800",
                                      EXPIRED: "border-red-200 bg-red-50 text-red-700",
                                    },
                                    row.medicalVisitStatus,
                                  ),
                                ].join(" ")}
                              >
                                {row.medicalVisitStatus ?? "EXPIRED"}
                              </span>
                            </div>
                            <p className="text-sm text-zinc-700">
                              Scadenza:{" "}
                              <span className="font-semibold text-zinc-900">
                                {dateFormatter.format(new Date(row.medicalVisit.expiryDate))}
                              </span>
                            </p>
                          </div>
                        ) : (
                          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            Nessuna visita medica registrata.
                          </p>
                        )}
                      </section>

                      <section className="rounded-lg border border-blue-100 bg-slate-50 p-3">
                        <h4 className="text-sm font-semibold text-zinc-900">Sezione calendario</h4>
                        {childEvents.length === 0 ? (
                          <p className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                            Nessun evento imminente.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {childEvents.map((event) => (
                              <li key={event.id} className="rounded-lg border border-blue-100 bg-white p-3">
                                <p className="text-sm font-semibold text-zinc-900">{event.title}</p>
                                <p className="text-xs uppercase tracking-wide text-blue-700">
                                  {formatEventType(event.type)}
                                </p>
                                <p className="mt-1 text-sm text-zinc-700">
                                  {dateTimeFormatter.format(new Date(event.startAt))}
                                </p>
                                <p className="text-sm text-zinc-700">Luogo: {event.location || "-"}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </section>
                    </div>

                    <section className="mt-4 rounded-lg border border-blue-100 bg-slate-50 p-3">
                      <h4 className="text-sm font-semibold text-zinc-900">Sezione comunicazioni</h4>
                      {childCommunications.length === 0 ? (
                        <p className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                          Nessuna comunicazione recente.
                        </p>
                      ) : (
                        <ul className="mt-2 space-y-2">
                          {childCommunications.map((announcement) => (
                            <li key={announcement.id} className="rounded-lg border border-blue-100 bg-white p-3">
                              <p className="text-sm font-semibold text-zinc-900">{announcement.title}</p>
                              <p className="mt-1 text-xs text-zinc-500">
                                {announcement.publishedAt
                                  ? dateFormatter.format(new Date(announcement.publishedAt))
                                  : "-"}
                                {announcement.category?.name
                                  ? ` - Categoria ${announcement.category.name}`
                                  : " - Comunicazione generale"}
                              </p>
                              <p className="mt-1 text-sm text-zinc-700">
                                {announcement.content.length > 160
                                  ? `${announcement.content.slice(0, 160)}...`
                                  : announcement.content}
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section className="mt-4 rounded-lg border border-blue-100 bg-slate-50 p-3">
                      <h4 className="text-sm font-semibold text-zinc-900">Documenti</h4>
                      {row.documents.length === 0 ? (
                        <p className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                          Nessun documento caricato.
                        </p>
                      ) : (
                        <div className="mt-2 overflow-x-auto">
                          <table className="min-w-full divide-y divide-blue-100 text-xs md:text-sm">
                            <thead>
                              <tr className="text-left text-[11px] uppercase tracking-wide text-blue-800">
                                <th className="px-2 py-2 font-semibold">Tipo</th>
                                <th className="px-2 py-2 font-semibold">Scadenza</th>
                                <th className="px-2 py-2 font-semibold">Stato</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-blue-50 text-zinc-700">
                              {row.documents.map((doc) => {
                                const status = computeExpiryBadgeStatus(doc.expiryDate, now);
                                return (
                                  <tr key={doc.id}>
                                    <td className="px-2 py-2 font-medium text-zinc-900">
                                      {DOCUMENT_TYPE_LABEL[doc.type] ?? doc.type}
                                    </td>
                                    <td className="px-2 py-2">
                                      {doc.expiryDate ? dateFormatter.format(new Date(doc.expiryDate)) : "-"}
                                    </td>
                                    <td className="px-2 py-2">
                                      <StatusBadge status={status} />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </section>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
