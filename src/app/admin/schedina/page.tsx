import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveSlipLockState } from "@/lib/prediction-slip";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";

const dateTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function AdminSchedinaPage() {
  const session = await getAuthSession();
  if (!session?.user) redirect("/login?callbackUrl=/admin/schedina");
  if (session.user.role !== "ADMIN") redirect("/unauthorized");

  const now = nowAsEuropeRomeWallClockUtc();
  const slips = await prisma.predictionSlip.findMany({
    orderBy: [{ closesAt: "desc" }, { createdAt: "desc" }],
    include: {
      _count: { select: { entries: true, events: true } },
    },
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Schedina Comun Nuovo"
          subtitle="Gioco gratuito 1 · X · 2"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex justify-end">
          <Link
            href="/admin/schedina/nuova"
            className="inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Nuova schedina
          </Link>
        </div>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          {slips.length === 0 ? (
            <p className="text-sm text-zinc-600">Nessuna schedina creata.</p>
          ) : (
            <ul className="divide-y divide-blue-50">
              {slips.map((slip) => {
                const lock =
                  slip.isPublished && slip.effectiveClosesAt
                    ? resolveSlipLockState({
                        lockedAt: slip.lockedAt,
                        effectiveClosesAt: slip.effectiveClosesAt,
                        now,
                      })
                    : null;
                const effective = slip.effectiveClosesAt;
                return (
                  <li key={slip.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-zinc-900">{slip.title}</p>
                      <p className="text-xs text-zinc-500">
                        {slip._count.events} partite · {slip._count.entries} partecipanti ·{" "}
                        {slip.isPublished ? "Pubblicata" : "Bozza"} ·{" "}
                        {lock?.state === "LOCKED" ? "Chiusa" : slip.isPublished ? "Aperta" : "—"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        Chiusura effettiva:{" "}
                        {effective ? dateTimeFormatter.format(effective) : "— (bozza)"}
                      </p>
                      <p className="text-xs text-zinc-500">Premio: {slip.prizeText}</p>
                    </div>
                    <Link
                      href={`/admin/schedina/${slip.id}`}
                      className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                    >
                      Dettaglio
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
