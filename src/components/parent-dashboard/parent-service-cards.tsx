import Link from "next/link";
import { ExternalLink, Gift, Shirt, Users } from "lucide-react";
import { OFFICIAL_TEAM_SHOP_URL } from "@/lib/family-benefits";

type ParentServiceCardsProps = {
  athleteId: string;
  benefitsCount: number;
  teamLabel: string;
};

export function ParentServiceCards({
  athleteId,
  benefitsCount,
  teamLabel,
}: ParentServiceCardsProps) {
  const qs = athleteId ? `?athleteId=${encodeURIComponent(athleteId)}` : "";

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      <a
        href={OFFICIAL_TEAM_SHOP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-3xl border border-blue-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-800 text-white">
          <Shirt className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-black text-blue-950">Abbigliamento societario</p>
        <p className="mt-1 text-xs text-zinc-600">
          Shop ufficiale Onis · ordini e pagamenti sul sito partner
        </p>
        <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-blue-800">
          Apri TeamShop <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </span>
      </a>

      <Link
        href={`/genitore/vantaggi${qs}`}
        className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-600 text-white">
          <Gift className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-black text-blue-950">Vantaggi per le famiglie</p>
        <p className="mt-1 text-xs text-zinc-600">
          {benefitsCount > 0
            ? `${benefitsCount} convenzion${benefitsCount === 1 ? "e" : "i"} attive`
            : "Convenzioni e sconti societari"}
        </p>
      </Link>

      <Link
        href={`/genitore/squadra${qs}`}
        className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-700 text-white">
          <Users className="h-5 w-5" aria-hidden />
        </span>
        <p className="mt-3 text-sm font-black text-blue-950">La mia squadra</p>
        <p className="mt-1 text-xs text-zinc-600">
          {teamLabel}: partite, calendario
          {/primi|pulcini|esordienti|scuola|gioco/i.test(teamLabel)
            ? " e attività"
            : " e classifica"}
        </p>
      </Link>
    </section>
  );
}
