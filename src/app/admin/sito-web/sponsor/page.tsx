import Link from "next/link";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteWebNav } from "@/components/site-web/site-web-nav";
import { prisma } from "@/lib/prisma";
import { SITE_SPONSOR_CATEGORY_LABELS } from "@/lib/site-cms";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

export default async function AdminSiteSponsorsPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/sponsor");

  const sponsors = await prisma.siteSponsor.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Sponsor sito web (Admin)"
          subtitle="Partner mostrati sul sito pubblico"
          userName={session.user.name ?? "Amministratore"}
        />
        <AdminBackLink href="/admin/sito-web" label="← Torna a Sito web" />
        <SiteWebNav />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-zinc-600">{sponsors.length} sponsor</p>
            <Link
              href="/admin/sito-web/sponsor/nuovo"
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 md:w-fit"
            >
              Nuovo sponsor
            </Link>
          </div>

          {sponsors.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
              Nessuno sponsor inserito. Crea il primo con &quot;Nuovo sponsor&quot;.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-100 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-blue-800">
                    <th className="px-3 py-2 font-semibold">Logo</th>
                    <th className="px-3 py-2 font-semibold">Nome</th>
                    <th className="px-3 py-2 font-semibold">Categoria</th>
                    <th className="px-3 py-2 font-semibold">Sito</th>
                    <th className="px-3 py-2 font-semibold">Stato</th>
                    <th className="px-3 py-2 font-semibold">Azioni</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blue-50 text-zinc-700">
                  {sponsors.map((sponsor) => (
                    <tr key={sponsor.id}>
                      <td className="px-3 py-2">
                        {sponsor.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- anteprima admin
                          <img
                            src={sponsor.logoUrl}
                            alt={sponsor.name}
                            className="h-10 w-16 rounded-md border border-zinc-200 bg-white object-contain p-1"
                          />
                        ) : (
                          <div className="flex h-10 w-16 items-center justify-center rounded-md border border-dashed border-zinc-300 text-[9px] font-semibold uppercase text-zinc-400">
                            N/D
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-zinc-900">{sponsor.name}</td>
                      <td className="px-3 py-2">{SITE_SPONSOR_CATEGORY_LABELS[sponsor.category]}</td>
                      <td className="px-3 py-2">
                        {sponsor.websiteUrl ? (
                          <a
                            href={sponsor.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-700 underline-offset-2 hover:underline"
                          >
                            Apri sito
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {sponsor.isVisible ? (
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
                          href={`/admin/sito-web/sponsor/${sponsor.id}/modifica`}
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
