import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { AnnouncementForm } from "@/components/communications/announcement-form";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { ANNOUNCEMENT_AUDIENCE_LABEL } from "@/lib/announcements";

const dateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export default async function AdminCommunicationsPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/comunicazioni");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const [categories, announcements] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.announcement.findMany({
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 80,
      select: {
        id: true,
        title: true,
        content: true,
        audience: true,
        publishedAt: true,
        category: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <AreaHeader
          title="Comunicazioni (Admin)"
          subtitle="Bacheca societaria e di categoria"
          userName={session.user.name ?? "Amministratore"}
        />

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna dashboard admin
          </Link>
          <Link
            href="/admin/media"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Vai a media categoria
          </Link>
        </div>

        <AnnouncementForm categories={categories} />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Comunicazioni pubblicate</h2>
          <p className="mt-1 text-sm text-zinc-600">Viste recenti ordinate per data pubblicazione.</p>

          {announcements.length === 0 ? (
            <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
              Nessuna comunicazione presente.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {announcements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="rounded-lg border border-blue-100 bg-slate-50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-900">{announcement.title}</h3>
                    <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      {ANNOUNCEMENT_AUDIENCE_LABEL[announcement.audience]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    Pubblicata il{" "}
                    {announcement.publishedAt ? dateFormatter.format(new Date(announcement.publishedAt)) : "-"} -
                    {announcement.category?.name
                      ? ` Categoria ${announcement.category.name}`
                      : " Comunicazione generale"}{" "}
                    - da {announcement.createdBy.name}
                  </p>
                  <p className="mt-2 text-sm text-zinc-700 whitespace-pre-wrap">{announcement.content}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
