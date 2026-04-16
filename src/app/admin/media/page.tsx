import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { MediaItemForm } from "@/components/media/media-item-form";
import { MediaGallery } from "@/components/media/media-gallery";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { ROLE_HOME_PATH } from "@/lib/permissions";

export default async function AdminMediaPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/media");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const [categories, mediaItems] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.mediaItem.findMany({
      where: {
        publishedAt: {
          not: null,
        },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 120,
      select: {
        id: true,
        title: true,
        description: true,
        mediaType: true,
        mediaUrl: true,
        filePath: true,
        publishedAt: true,
        category: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const galleryItems = mediaItems.map((item) => ({
    ...item,
    categoryName: item.category.name,
    createdByName: item.createdBy.name,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Media per categoria (Admin)"
          subtitle="Gestione foto e video di tutte le categorie"
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
            href="/admin/comunicazioni"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Vai a comunicazioni
          </Link>
        </div>

        {categories.length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-700">
            Nessuna categoria disponibile per creare media.
          </p>
        ) : (
          <MediaItemForm categories={categories} title="Nuovo media categoria (Admin)" />
        )}

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Galleria media</h2>
          <p className="mt-1 text-sm text-zinc-600">Visualizzi tutti i media pubblicati dalle aree abilitate.</p>
          <div className="mt-4">
            <MediaGallery items={galleryItems} emptyMessage="Nessun media pubblicato." />
          </div>
        </section>
      </div>
    </main>
  );
}
