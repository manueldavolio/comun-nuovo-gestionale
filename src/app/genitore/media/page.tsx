import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { MediaGallery } from "@/components/media/media-gallery";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";

export default async function ParentMediaPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/genitore/media");
  }

  if (session.user.role !== "PARENT") {
    redirect("/unauthorized");
  }

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      athletes: {
        select: {
          categoryId: true,
        },
      },
    },
  });

  if (!parentProfile) {
    redirect("/unauthorized");
  }

  const categoryIds = Array.from(new Set(parentProfile.athletes.map((athlete) => athlete.categoryId)));
  const now = new Date();

  const mediaItems =
    categoryIds.length === 0
      ? []
      : await prisma.mediaItem.findMany({
          where: {
            categoryId: {
              in: categoryIds,
            },
            publishedAt: {
              not: null,
              lte: now,
            },
          },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          take: 80,
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
        });

  const galleryItems = mediaItems.map((item) => ({
    ...item,
    categoryName: item.category.name,
    createdByName: item.createdBy.name,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Media categoria (Genitore)"
          subtitle="Foto e video delle categorie dei tuoi figli"
          userName={session.user.name ?? "Genitore"}
        />

        <div className="flex flex-wrap gap-2">
          <Link
            href="/genitore"
            className="inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Torna dashboard genitore
          </Link>
        </div>

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">Galleria categoria</h2>
          <div className="mt-4">
            <MediaGallery
              items={galleryItems}
              emptyMessage="Nessun media disponibile per le categorie dei tuoi figli."
            />
          </div>
        </section>
      </div>
    </main>
  );
}
