import Link from "next/link";
import { AdminBackLink } from "@/components/admin/admin-back-link";
import { AreaHeader } from "@/components/layout/area-header";
import { SiteWebNav } from "@/components/site-web/site-web-nav";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminPage } from "@/lib/site-cms-server";

const SECTIONS = [
  {
    href: "/admin/sito-web/giocatori",
    title: "Giocatori",
    description: "Rose squadre: nome, ruolo, numero maglia, foto e descrizione.",
  },
  {
    href: "/admin/sito-web/staff",
    title: "Staff",
    description: "Dirigenti, allenatori e collaboratori mostrati sul sito.",
  },
  {
    href: "/admin/sito-web/news",
    title: "News",
    description: "Articoli con copertina, bozze e pubblicazione.",
  },
  {
    href: "/admin/sito-web/sponsor",
    title: "Sponsor",
    description: "Partner del club con logo, link e categoria.",
  },
  {
    href: "/admin/sito-web/galleria",
    title: "Galleria foto",
    description: "Album fotografici con upload multiplo di immagini.",
  },
  {
    href: "/admin/sito-web/video",
    title: "Video",
    description: "Video YouTube mostrati nella pagina Media.",
  },
  {
    href: "/admin/sito-web/impostazioni",
    title: "Impostazioni sito",
    description: "Numeri homepage: anno di fondazione, squadre, tesserati, campi.",
  },
] as const;

export default async function AdminSiteWebPage() {
  const session = await requireSiteWebAdminPage("/admin/sito-web");

  const [playersCount, staffCount, newsCount, sponsorsCount, albumsCount, videosCount] =
    await Promise.all([
      prisma.sitePlayer.count(),
      prisma.siteStaffMember.count(),
      prisma.siteNews.count(),
      prisma.siteSponsor.count(),
      prisma.siteGalleryAlbum.count(),
      prisma.siteVideo.count(),
    ]).catch(() => [0, 0, 0, 0, 0, 0]);

  const counts: Record<string, number | null> = {
    "/admin/sito-web/giocatori": playersCount,
    "/admin/sito-web/staff": staffCount,
    "/admin/sito-web/news": newsCount,
    "/admin/sito-web/sponsor": sponsorsCount,
    "/admin/sito-web/galleria": albumsCount,
    "/admin/sito-web/video": videosCount,
    "/admin/sito-web/impostazioni": null,
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Sito web (Admin)"
          subtitle="Contenuti del sito pubblico asdcomunnuovo.it"
          userName={session.user.name ?? "Amministratore"}
        />
        <AdminBackLink />
        <SiteWebNav />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="group flex flex-col gap-2 rounded-xl border border-blue-100 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-zinc-900 group-hover:text-blue-800">
                  {section.title}
                </h2>
                {counts[section.href] !== null ? (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                    {counts[section.href]}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-zinc-600">{section.description}</p>
              <span className="mt-auto text-sm font-semibold text-blue-700">Gestisci →</span>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
