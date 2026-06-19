import Link from "next/link";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteWebNav } from "@/components/site-web/site-web-nav";
import { prisma } from "@/lib/prisma";
import {
  SITE_PLAYER_ROLE_LABELS,
  SITE_TEAM_LABELS,
  type SiteTeamValue,
} from "@/lib/site-cms";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

type AdminSitePlayersPageProps = {
  searchParams: Promise<{ squadra?: string }>;
};

function parseTeam(value: string | undefined): SiteTeamValue | "all" {
  if (value && value in SITE_TEAM_LABELS) {
    return value as SiteTeamValue;
  }
  return "all";
}

export default async function AdminSitePlayersPage({ searchParams }: AdminSitePlayersPageProps) {
  const session = await requireSiteWebAdminPage("/admin/sito-web/giocatori");

  const params = await searchParams;
  const team = parseTeam(params.squadra);

  const players = await prisma.sitePlayer.findMany({
    where: team === "all" ? {} : { team },
    orderBy: [{ team: "asc" }, { role: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Giocatori sito web (Admin)"
          subtitle="Rose squadre mostrate sul sito pubblico"
          userName={session.user.name ?? "Amministratore"}
        />
        <AdminBackLink href="/admin/sito-web" label="← Torna a Sito web" />
        <SiteWebNav />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-zinc-600">{players.length} giocatore/i</p>
              <p className="mt-1 text-xs text-zinc-500">
                Squadra:{" "}
                <span className="font-semibold">
                  {team === "all" ? "Tutte" : SITE_TEAM_LABELS[team]}
                </span>
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
              <Link
                href="/admin/sito-web/giocatori/nuovo"
                className="inline-flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 md:w-fit"
              >
                Nuovo giocatore
              </Link>

              <form method="get" className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                <select
                  name="squadra"
                  defaultValue={team}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
                >
                  <option value="all">Tutte le squadre</option>
                  {Object.entries(SITE_TEAM_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
                >
                  Filtra
                </button>
              </form>
            </div>
          </div>

          {players.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Nessun giocatore inserito. Crea il primo con &quot;Nuovo giocatore&quot;.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Foto</th>
                    <th className="px-3 py-2 font-semibold">Nome</th>
                    <th className="px-3 py-2 font-semibold">Squadra</th>
                    <th className="px-3 py-2 font-semibold">Ruolo</th>
                    <th className="px-3 py-2 font-semibold">Maglia</th>
                    <th className="px-3 py-2 font-semibold">Stato</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {players.map((player) => (
                    <tr key={player.id}>
                      <td className="px-3 py-2">
                        {player.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- anteprima admin
                          <img
                            src={player.photoUrl}
                            alt={player.name}
                            className="h-10 w-10 rounded-full border border-zinc-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-zinc-300 text-[9px] font-semibold uppercase text-zinc-400">
                            N/D
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-900">{player.name}</td>
                      <td className="px-3 py-2">{SITE_TEAM_LABELS[player.team]}</td>
                      <td className="px-3 py-2">{SITE_PLAYER_ROLE_LABELS[player.role]}</td>
                      <td className="px-3 py-2">{player.shirtNumber ?? "-"}</td>
                      <td className="px-3 py-2">
                        {player.isVisible ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                            Visibile
                          </span>
                        ) : (
                          <span className="rounded-full border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs font-semibold text-zinc-700">
                            Nascosto
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/admin/sito-web/giocatori/${player.id}/modifica`}
                          className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        >
                          Modifica
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
