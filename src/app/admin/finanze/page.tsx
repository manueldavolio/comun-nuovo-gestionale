import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { FinanceEntryForm } from "@/components/finance/finance-entry-form";
import { FINANCE_CATEGORY_LABEL, euroFormatter } from "@/lib/finance";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const ENTRY_TYPE_LABEL = {
  INCOME: "Entrata",
  EXPENSE: "Uscita",
} as const;

function toAmountNumber(value: { toString: () => string }) {
  return Number(value.toString());
}

export default async function AdminFinanzePage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/finanze");
  }

  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const [entries, enrollmentPayments] = await Promise.all([
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Finanze societa"
          subtitle="Entrate, uscite e previsione di bilancio"
          userName={session.user.name ?? "Amministratore"}
        />

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">Totale entrate</p>
            <p className="mt-2 text-4xl font-bold text-emerald-700">{euroFormatter.format(currentIncome)}</p>
          </article>
          <article className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-red-800">Totale uscite</p>
            <p className="mt-2 text-4xl font-bold text-red-700">{euroFormatter.format(currentExpense)}</p>
          </article>
          <article className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-800">Saldo attuale</p>
            <p className={`mt-2 text-4xl font-bold ${currentBalance >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {euroFormatter.format(currentBalance)}
            </p>
          </article>
        </section>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Previsione bilancio</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Le entrate previste includono iscrizioni pianificate (acconto + saldo) e movimenti forecast manuali.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Entrate previste</p>
              <p className="mt-1 text-2xl font-bold text-emerald-700">{euroFormatter.format(forecastIncome)}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-800">Uscite previste</p>
              <p className="mt-1 text-2xl font-bold text-red-700">{euroFormatter.format(forecastExpense)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">Saldo previsto</p>
              <p className={`mt-1 text-2xl font-bold ${forecastBalance >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {euroFormatter.format(forecastBalance)}
              </p>
            </div>
          </div>
        </section>

        <FinanceEntryForm />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Lista movimenti</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Storico movimenti inseriti manualmente e movimenti automatici da pagamenti iscrizione.
          </p>

          {entries.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Nessun movimento registrato.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Data</th>
                    <th className="px-3 py-2 font-semibold">Tipo</th>
                    <th className="px-3 py-2 font-semibold">Categoria</th>
                    <th className="px-3 py-2 font-semibold">Importo</th>
                    <th className="px-3 py-2 font-semibold">Descrizione</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {entries.map((entry) => {
                    const category =
                      FINANCE_CATEGORY_LABEL[entry.category as keyof typeof FINANCE_CATEGORY_LABEL] ??
                      entry.category;
                    return (
                      <tr key={entry.id}>
                        <td className="px-3 py-2">{dateFormatter.format(new Date(entry.date))}</td>
                        <td className="px-3 py-2">
                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                              entry.type === "INCOME"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-red-200 bg-red-50 text-red-700",
                            ].join(" ")}
                          >
                            {ENTRY_TYPE_LABEL[entry.type]}
                          </span>
                        </td>
                        <td className="px-3 py-2">{category}</td>
                        <td className={`px-3 py-2 font-semibold ${entry.type === "INCOME" ? "text-emerald-700" : "text-red-700"}`}>
                          {euroFormatter.format(toAmountNumber(entry.amount))}
                        </td>
                        <td className="px-3 py-2">
                          {entry.description}
                          {entry.isForecast ? (
                            <span className="ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
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
          )}
        </section>
      </div>
    </main>
  );
}
