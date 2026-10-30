import Link from "next/link";
import { redirect } from "next/navigation";
import type { PaymentStatus } from "@prisma/client";
import { Search, Wallet } from "lucide-react";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { BankSettingsForm } from "@/components/finance/bank-settings-form";
import { BankTransferReviewActions } from "@/components/finance/bank-transfer-review-actions";
import { FinanceEntryForm } from "@/components/finance/finance-entry-form";
import { RegenerateCheckoutButton } from "@/components/finance/regenerate-checkout-button";
import { RegenerateReceiptButton } from "@/components/finance/regenerate-receipt-button";
import { formatIbanForDisplay, getClubBankSettings } from "@/lib/bank-transfer";
import { FINANCE_CATEGORY_LABEL, euroFormatter } from "@/lib/finance";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEnrollmentPaymentCheckoutRetryable } from "@/lib/stripe-checkout-expiry-policy";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const ENTRY_TYPE_LABEL = {
  INCOME: "Entrata",
  EXPENSE: "Uscita",
} as const;

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "In sospeso",
  OVERDUE: "In ritardo (OVERDUE)",
  PAID: "Pagato",
  CANCELLED: "Annullato",
};

const PAYMENT_STATUS_FILTERS = ["PENDING", "OVERDUE", "PAID", "CANCELLED"] as const;

function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUS_FILTERS as readonly string[]).includes(value);
}

function toAmountNumber(value: { toString: () => string }) {
  return Number(value.toString());
}

function paymentStatusBadgeClass(status: PaymentStatus) {
  switch (status) {
    case "PAID":
      return "bg-sky-100 text-sky-900 ring-1 ring-sky-200";
    case "PENDING":
      return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
    case "OVERDUE":
      return "bg-red-50 text-red-800 ring-1 ring-red-200";
    case "CANCELLED":
      return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
    default:
      return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  }
}

function canRegenerateCheckout(input: {
  type: string;
  status: PaymentStatus;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
}) {
  return isEnrollmentPaymentCheckoutRetryable({
    type: input.type,
    status: input.status,
    hasStripePaymentIntent: Boolean(input.stripePaymentIntentId?.trim()),
    hasStripeCheckoutSessionId: Boolean(input.stripeCheckoutSessionId?.trim()),
  });
}

type AdminFinanzePageProps = {
  searchParams?: Promise<{ q?: string; status?: string }>;
};

export default async function AdminFinanzePage({ searchParams }: AdminFinanzePageProps) {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/finanze");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const params = searchParams ? await searchParams : {};
  const q = (params?.q ?? "").trim();
  const statusFilter = isPaymentStatus(params?.status ?? "") ? (params.status as PaymentStatus) : "";

  const [
    entries,
    enrollmentPayments,
    enrollmentPaymentsDetail,
    pendingToCollect,
    bankSettings,
    bankTransfersToReview,
  ] = await Promise.all([
      prisma.accountingEntry.findMany({
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 300,
        select: {
          id: true,
          type: true,
          category: true,
          amount: true,
          description: true,
          date: true,
          isForecast: true,
        },
      }),
      prisma.payment.findMany({
        where: {
          type: { in: ["DEPOSIT", "BALANCE"] },
          status: { not: "CANCELLED" },
        },
        select: { amount: true },
      }),
      prisma.payment.findMany({
        where: {
          type: { in: ["DEPOSIT", "BALANCE"] },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 300,
        select: {
          id: true,
          type: true,
          amount: true,
          status: true,
          paidAt: true,
          dueDate: true,
          stripeCheckoutSessionId: true,
          stripePaymentIntentId: true,
          receipt: {
            select: {
              id: true,
              receiptNumber: true,
              filePath: true,
            },
          },
          enrollment: {
            select: {
              seasonLabel: true,
              athlete: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      // Stessa logica della dashboard admin: PENDING + OVERDUE (tutti i tipi Payment).
      prisma.payment.aggregate({
        where: {
          status: {
            in: ["PENDING", "OVERDUE"],
          },
        },
        _count: { id: true },
        _sum: { amount: true },
      }),
      getClubBankSettings(),
      prisma.bankTransferRequest.findMany({
        where: { status: "UNDER_REVIEW" },
        orderBy: { proofUploadedAt: "asc" },
        take: 100,
        select: {
          id: true,
          amount: true,
          causal: true,
          proofUploadedAt: true,
          createdAt: true,
          createdBy: { select: { name: true, email: true } },
          payment: {
            select: {
              id: true,
              type: true,
              enrollment: {
                select: {
                  seasonLabel: true,
                  category: { select: { name: true } },
                  athlete: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

  const currentIncome = entries
    .filter((entry) => entry.type === "INCOME" && !entry.isForecast)
    .reduce((sum, entry) => sum + toAmountNumber(entry.amount), 0);
  const currentExpense = entries
    .filter((entry) => entry.type === "EXPENSE" && !entry.isForecast)
    .reduce((sum, entry) => sum + toAmountNumber(entry.amount), 0);
  const currentBalance = currentIncome - currentExpense;

  const enrollmentForecastIncome = enrollmentPayments.reduce(
    (sum, payment) => sum + toAmountNumber(payment.amount),
    0,
  );
  const manualForecastIncome = entries
    .filter((entry) => entry.type === "INCOME" && entry.isForecast)
    .reduce((sum, entry) => sum + toAmountNumber(entry.amount), 0);
  const forecastExpense = entries
    .filter((entry) => entry.type === "EXPENSE" && entry.isForecast)
    .reduce((sum, entry) => sum + toAmountNumber(entry.amount), 0);

  const forecastIncome = enrollmentForecastIncome + manualForecastIncome;
  const forecastBalance = forecastIncome - forecastExpense;

  const toCollectCount = pendingToCollect._count.id;
  const toCollectAmount =
    pendingToCollect._sum.amount != null ? toAmountNumber(pendingToCollect._sum.amount) : 0;

  const qNormalized = q.toLowerCase();
  const filteredPayments = enrollmentPaymentsDetail.filter((payment) => {
    if (statusFilter && payment.status !== statusFilter) {
      return false;
    }
    if (!qNormalized) {
      return true;
    }
    const fullName =
      `${payment.enrollment.athlete.firstName} ${payment.enrollment.athlete.lastName}`.toLowerCase();
    return fullName.includes(qNormalized);
  });

  const actionNeeded = enrollmentPaymentsDetail.filter(
    (payment) => payment.status === "PENDING" || payment.status === "OVERDUE",
  );

  return (
    <main className="p-4 md:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 md:gap-5">
        <header className="overflow-hidden rounded-3xl border border-blue-800/30 bg-gradient-to-br from-blue-950 via-blue-900 to-sky-700 text-white shadow-lg shadow-blue-950/15">
          <div className="relative p-5 sm:p-6">
            <div
              className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl"
              aria-hidden
            />
            <div className="relative flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <Wallet className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-200">
                  Amministrazione
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">Finanze</h1>
                <p className="mt-1 text-sm font-medium text-sky-100">
                  Contabilità, previsioni e quote iscrizione
                </p>
              </div>
            </div>
          </div>
        </header>

        <AdminBackLink />

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
              Entrate contabilizzate
            </p>
            <p className="mt-2 text-2xl font-black text-blue-950">
              {euroFormatter.format(currentIncome)}
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-500">
              Da movimenti non-previsione (ultimi {entries.length} caricati)
            </p>
          </article>
          <article className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
              Uscite contabilizzate
            </p>
            <p className="mt-2 text-2xl font-black text-blue-950">
              {euroFormatter.format(currentExpense)}
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-500">
              Da movimenti non-previsione (ultimi {entries.length} caricati)
            </p>
          </article>
          <article className="rounded-3xl border border-blue-200 bg-gradient-to-br from-white to-sky-50 p-4 shadow-sm sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
              Saldo attuale
            </p>
            <p className="mt-2 text-2xl font-black text-blue-950">
              {euroFormatter.format(currentBalance)}
            </p>
            <p className="mt-1 text-xs font-medium text-zinc-500">Entrate − uscite contabilizzate</p>
          </article>
        </section>

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-blue-950">Previsione bilancio</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Le entrate previste sommano acconti/saldi iscrizione non annullati{" "}
            <span className="font-semibold text-blue-900">(incluso PAID)</span> e i movimenti
            manuali segnati come previsione. Non sommare questo blocco al saldo attuale: sono
            letture separate.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
                Entrate previste
              </p>
              <p className="mt-1 text-xl font-black text-blue-950">
                {euroFormatter.format(forecastIncome)}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
                Uscite previste
              </p>
              <p className="mt-1 text-xl font-black text-blue-950">
                {euroFormatter.format(forecastExpense)}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 ring-1 ring-sky-100">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
                Saldo previsto
              </p>
              <p className="mt-1 text-xl font-black text-blue-950">
                {euroFormatter.format(forecastBalance)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-blue-950">Quote ancora da incassare</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Stessa logica della dashboard admin: pagamenti in stato{" "}
            <span className="font-semibold">In sospeso (PENDING)</span> o{" "}
            <span className="font-semibold">In ritardo (OVERDUE)</span>. OVERDUE non equivale
            automaticamente alla scadenza della data quota.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800/80">
                Numero
              </p>
              <p className="mt-1 text-3xl font-black text-amber-950">{toCollectCount}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-amber-800/80">
                Importo
              </p>
              <p className="mt-1 text-3xl font-black text-amber-950">
                {euroFormatter.format(toCollectAmount)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-blue-950">Bonifici da verificare</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Approva solo dopo controllo dell&apos;accredito sul conto. Contatore richieste in
                verifica:{" "}
                <span className="font-black text-indigo-900">{bankTransfersToReview.length}</span>
              </p>
            </div>
            <span className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full bg-indigo-700 px-3 text-lg font-black text-white">
              {bankTransfersToReview.length}
            </span>
          </div>
          {bankTransfersToReview.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">Nessun bonifico in attesa di verifica.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {bankTransfersToReview.map((row) => {
                const athlete = row.payment.enrollment.athlete;
                return (
                  <li
                    key={row.id}
                    className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1 text-sm">
                        <p className="font-bold text-blue-950">
                          {athlete.lastName} {athlete.firstName} ·{" "}
                          {row.payment.enrollment.category.name}
                        </p>
                        <p className="text-zinc-600">
                          Stagione {row.payment.enrollment.seasonLabel} · Genitore{" "}
                          {row.createdBy.name} ({row.createdBy.email})
                        </p>
                        <p className="font-semibold tabular-nums text-blue-950">
                          {euroFormatter.format(toAmountNumber(row.amount))}
                        </p>
                        <p className="font-mono text-xs text-zinc-600">Causale: {row.causal}</p>
                        <p className="text-xs text-zinc-500">
                          Caricata:{" "}
                          {row.proofUploadedAt
                            ? dateFormatter.format(row.proofUploadedAt)
                            : dateFormatter.format(row.createdAt)}
                        </p>
                      </div>
                      <BankTransferReviewActions requestId={row.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-blue-950">Coordinate bancarie club</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Visibili ai genitori solo se beneficiario e IBAN sono entrambi compilati.
            {bankSettings?.iban
              ? ` Attuale: ${formatIbanForDisplay(bankSettings.iban)}.`
              : " Non ancora configurate."}
          </p>
          <div className="mt-4 max-w-xl">
            <BankSettingsForm
              initialBeneficiary={bankSettings?.beneficiary ?? ""}
              initialIban={bankSettings?.iban ?? ""}
            />
          </div>
        </section>

        <FinanceEntryForm />

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-black text-blue-950">Pagamenti iscrizione</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Ultimi {enrollmentPaymentsDetail.length} acconti/saldi caricati. Filtri sulla lista
                visualizzata.
              </p>
            </div>
          </div>

          <form method="get" className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
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
              defaultValue={statusFilter}
              aria-label="Filtro stato pagamento"
              className="min-h-12 rounded-2xl border border-sky-200 bg-white px-3 text-sm font-semibold text-blue-950 outline-none ring-blue-500 focus:ring-2"
            >
              <option value="">Tutti gli stati</option>
              {PAYMENT_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {PAYMENT_STATUS_LABEL[status]}
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
              {q || statusFilter ? (
                <Link
                  href="/admin/finanze"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-blue-200 bg-white px-4 text-sm font-bold text-blue-800 hover:bg-sky-50"
                >
                  Reset
                </Link>
              ) : null}
            </div>
          </form>

          {!statusFilter && !q && actionNeeded.length > 0 ? (
            <div className="mt-5">
              <h3 className="text-sm font-black text-red-800">Da gestire subito</h3>
              <p className="mt-1 text-xs font-medium text-zinc-500">
                In sospeso e in ritardo tra gli ultimi {enrollmentPaymentsDetail.length} caricati.
              </p>
              <ul className="mt-3 grid gap-2 md:hidden">
                {actionNeeded.slice(0, 8).map((payment) => (
                  <PaymentCard key={`prio-m-${payment.id}`} payment={payment} priority />
                ))}
              </ul>
              <div className="mt-3 hidden overflow-hidden rounded-2xl border border-red-100 md:block">
                <PaymentTable payments={actionNeeded.slice(0, 12)} />
              </div>
            </div>
          ) : null}

          <div className="mt-6">
            <h3 className="text-sm font-black text-blue-950">
              Elenco{q || statusFilter ? " filtrato" : ""} ({filteredPayments.length})
            </h3>
            {filteredPayments.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-4 py-6 text-center text-sm text-zinc-600">
                Nessun pagamento trovato con i filtri selezionati.
              </p>
            ) : (
              <>
                <ul className="mt-3 grid gap-3 md:hidden">
                  {filteredPayments.map((payment) => (
                    <PaymentCard key={payment.id} payment={payment} />
                  ))}
                </ul>
                <div className="mt-3 hidden overflow-hidden rounded-2xl border border-sky-100 md:block">
                  <PaymentTable payments={filteredPayments} />
                </div>
              </>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-black text-blue-950">Lista movimenti</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Ultimi {entries.length} movimenti caricati (manuali e automatici da iscrizione). Non è
            necessariamente l&apos;intero storico.
          </p>

          {entries.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-sky-200 bg-sky-50/40 px-4 py-6 text-center text-sm text-zinc-600">
              Nessun movimento registrato.
            </p>
          ) : (
            <>
              <ul className="mt-4 grid gap-2 md:hidden">
                {entries.map((entry) => {
                  const category =
                    FINANCE_CATEGORY_LABEL[entry.category as keyof typeof FINANCE_CATEGORY_LABEL] ??
                    entry.category;
                  return (
                    <li
                      key={entry.id}
                      className="rounded-2xl border border-sky-100 bg-sky-50/40 px-4 py-3 text-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-blue-950">{ENTRY_TYPE_LABEL[entry.type]}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {dateFormatter.format(new Date(entry.date))} · {category}
                          </p>
                        </div>
                        <p
                          className={`font-black ${entry.type === "INCOME" ? "text-blue-900" : "text-slate-700"}`}
                        >
                          {euroFormatter.format(toAmountNumber(entry.amount))}
                        </p>
                      </div>
                      <p className="mt-2 text-zinc-700">{entry.description}</p>
                      {entry.isForecast ? (
                        <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 ring-1 ring-amber-200">
                          Previsione
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 hidden overflow-hidden rounded-2xl border border-sky-100 md:block">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-sky-100 bg-sky-50/50 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">Categoria</th>
                      <th className="px-4 py-3">Importo</th>
                      <th className="px-4 py-3">Descrizione</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const category =
                        FINANCE_CATEGORY_LABEL[
                          entry.category as keyof typeof FINANCE_CATEGORY_LABEL
                        ] ?? entry.category;
                      return (
                        <tr
                          key={entry.id}
                          className="border-b border-sky-50 align-top last:border-0 hover:bg-sky-50/40"
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                            {dateFormatter.format(new Date(entry.date))}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ${
                                entry.type === "INCOME"
                                  ? "bg-sky-100 text-sky-900 ring-sky-200"
                                  : "bg-slate-100 text-slate-700 ring-slate-200"
                              }`}
                            >
                              {ENTRY_TYPE_LABEL[entry.type]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-zinc-700">{category}</td>
                          <td className="px-4 py-3 font-bold text-blue-950">
                            {euroFormatter.format(toAmountNumber(entry.amount))}
                          </td>
                          <td className="px-4 py-3 text-zinc-700">
                            {entry.description}
                            {entry.isForecast ? (
                              <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900 ring-1 ring-amber-200">
                                Previsione
                              </span>
                            ) : null}
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
      </div>
    </main>
  );
}

type PaymentRow = {
  id: string;
  type: "DEPOSIT" | "BALANCE" | "OTHER";
  amount: { toString: () => string };
  status: PaymentStatus;
  paidAt: Date | null;
  dueDate: Date;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  receipt: { id: string; receiptNumber: string; filePath: string | null } | null;
  enrollment: {
    seasonLabel: string;
    athlete: { id: string; firstName: string; lastName: string };
  };
};

function PaymentTable({ payments }: { payments: PaymentRow[] }) {
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-sky-100 bg-sky-50/50 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-blue-800/70">
          <th className="px-4 py-3">Atleta</th>
          <th className="px-4 py-3">Stagione</th>
          <th className="px-4 py-3">Tipo</th>
          <th className="px-4 py-3">Scadenza quota</th>
          <th className="px-4 py-3">Stato</th>
          <th className="px-4 py-3">Importo</th>
          <th className="px-4 py-3">Azioni</th>
          <th className="px-4 py-3">Ricevuta</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((payment) => {
          const athleteName =
            `${payment.enrollment.athlete.firstName} ${payment.enrollment.athlete.lastName}`.trim();
          return (
            <tr
              key={payment.id}
              className="border-b border-sky-50 align-top last:border-0 hover:bg-sky-50/40"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/admin/atleti/${payment.enrollment.athlete.id}`}
                  className="font-bold text-blue-900 hover:underline"
                >
                  {athleteName}
                </Link>
              </td>
              <td className="px-4 py-3 text-zinc-600">{payment.enrollment.seasonLabel}</td>
              <td className="px-4 py-3 text-zinc-700">
                {payment.type === "DEPOSIT" ? "Acconto" : payment.type === "BALANCE" ? "Saldo" : "Altro"}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-zinc-600">
                {dateFormatter.format(new Date(payment.dueDate))}
                <p className="mt-0.5 text-[10px] font-medium text-zinc-400">
                  Data quota · non definisce lo stato
                </p>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${paymentStatusBadgeClass(payment.status)}`}
                >
                  {PAYMENT_STATUS_LABEL[payment.status]}
                </span>
              </td>
              <td className="px-4 py-3 font-bold text-blue-950">
                {euroFormatter.format(toAmountNumber(payment.amount))}
              </td>
              <td className="px-4 py-3">
                {canRegenerateCheckout(payment) ? (
                  <RegenerateCheckoutButton paymentId={payment.id} />
                ) : (
                  <span className="text-xs font-medium text-zinc-500">Checkout non disponibile</span>
                )}
              </td>
              <td className="px-4 py-3">
                {payment.status === "PAID" ? (
                  <div className="flex flex-col gap-1">
                    {payment.receipt?.filePath ? (
                      <a
                        href={`/api/genitore/receipts/${payment.receipt.id}/download`}
                        className="inline-flex w-fit rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-sky-100"
                      >
                        {payment.receipt.receiptNumber}
                      </a>
                    ) : null}
                    <RegenerateReceiptButton paymentId={payment.id} />
                  </div>
                ) : (
                  <span className="text-xs font-medium text-zinc-500">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PaymentCard({ payment, priority = false }: { payment: PaymentRow; priority?: boolean }) {
  const athleteName =
    `${payment.enrollment.athlete.firstName} ${payment.enrollment.athlete.lastName}`.trim();

  return (
    <li
      className={`rounded-3xl border p-4 shadow-sm ${
        priority ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white" : "border-sky-100 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/admin/atleti/${payment.enrollment.athlete.id}`}
            className="text-base font-black text-blue-950 hover:underline"
          >
            {athleteName}
          </Link>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {payment.enrollment.seasonLabel} ·{" "}
            {payment.type === "DEPOSIT" ? "Acconto" : payment.type === "BALANCE" ? "Saldo" : "Altro"}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${paymentStatusBadgeClass(payment.status)}`}
        >
          {PAYMENT_STATUS_LABEL[payment.status]}
        </span>
      </div>
      <p className="mt-3 text-xl font-black text-blue-950">
        {euroFormatter.format(toAmountNumber(payment.amount))}
      </p>
      <p className="mt-1 text-xs text-zinc-500">
        Scadenza quota: {dateFormatter.format(new Date(payment.dueDate))} (informativa)
      </p>
      <div className="mt-4 flex flex-col gap-2 border-t border-sky-100 pt-3">
        {canRegenerateCheckout(payment) ? (
          <RegenerateCheckoutButton paymentId={payment.id} />
        ) : null}
        {payment.status === "PAID" ? (
          <div className="flex flex-col gap-2">
            {payment.receipt?.filePath ? (
              <a
                href={`/api/genitore/receipts/${payment.receipt.id}/download`}
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-bold text-blue-800"
              >
                Ricevuta {payment.receipt.receiptNumber}
              </a>
            ) : null}
            <RegenerateReceiptButton paymentId={payment.id} />
          </div>
        ) : null}
        {!canRegenerateCheckout(payment) && payment.status !== "PAID" ? (
          <p className="text-xs font-medium text-zinc-500">Nessuna azione checkout</p>
        ) : null}
      </div>
    </li>
  );
}
