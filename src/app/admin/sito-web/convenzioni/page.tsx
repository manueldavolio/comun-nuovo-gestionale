import Link from "next/link";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteWebNav } from "@/components/site-web/site-web-nav";
import { FAMILY_BENEFIT_AUDIENCE_LABEL } from "@/lib/family-benefits";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

export default async function AdminConvenzioniPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web/convenzioni");
  const rows = await prisma.familyBenefit.findMany({
    orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Convenzioni famiglie"
          subtitle="Vantaggi pubblicati nell'area genitori"
          userName={session.user.name ?? "Amministratore"}
        />
        <AdminBackLink href="/admin/sito-web" label="← Torna a Sito web" />
        <SiteWebNav />
        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600">{rows.length} convenzioni</p>
            <Link
              href="/admin/sito-web/convenzioni/nuova"
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Nuova convenzione
            </Link>
          </div>
          {rows.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-600">Nessuna convenzione ancora.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2"
                >
                  <div>
                    <p className="font-bold text-blue-950">{row.name}</p>
                    <p className="text-xs text-zinc-600">
                      {FAMILY_BENEFIT_AUDIENCE_LABEL[row.audience]} ·{" "}
                      {row.isPublished && row.isActive ? "Pubblicata" : "Non visibile"} · priorità{" "}
                      {row.priority}
                    </p>
                  </div>
                  <Link
                    href={`/admin/sito-web/convenzioni/${row.id}/modifica`}
                    className="text-sm font-bold text-blue-800 underline"
                  >
                    Modifica
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
