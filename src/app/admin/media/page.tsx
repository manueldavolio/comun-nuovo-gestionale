import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MediaReviewPanel,
  type MediaReviewItem,
} from "@/components/admin/media-review-panel";
import { AreaHeader } from "@/components/layout/area-header";
import { MediaItemForm } from "@/components/media/media-item-form";
import { MediaGallery } from "@/components/media/media-gallery";
import { getAuthSession } from "@/lib/auth";
import { resolveAthleteImageConsent } from "@/lib/image-consent";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  categoryListWhereForAdminRole,
  youthDirectorMediaItemWhere,
} from "@/lib/youth-director-data-access";

export default async function AdminMediaPage() {
  const session = await getAuthSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/media");
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const isYouthDirector = session.user.role === "YOUTH_DIRECTOR";
  const categoryScope = categoryListWhereForAdminRole(session.user.role, false);
  if (!categoryScope) {
    redirect(ROLE_HOME_PATH[session.user.role]);
  }

  const [categories, mediaItems] = await Promise.all([
    prisma.category.findMany({
      where: categoryScope,
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.mediaItem.findMany({
      where: {
        ...(isYouthDirector ? youthDirectorMediaItemWhere() : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 120,
      select: {
        id: true,
        title: true,
        description: true,
        mediaType: true,
        mediaUrl: true,
        filePath: true,
        publishedAt: true,
        reviewStatus: true,
        subjectsDeclaredComplete: true,
        categoryId: true,
        subjects: { select: { athleteId: true } },
        category: { select: { id: true, name: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const categoryIds = Array.from(new Set(mediaItems.map((item) => item.categoryId)));
  const athletesByCategory = new Map<
    string,
    Array<{ id: string; firstName: string; lastName: string }>
  >();

  if (categoryIds.length > 0) {
    const athletes = await prisma.athlete.findMany({
      where: { categoryId: { in: categoryIds } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, categoryId: true },
    });
    for (const athlete of athletes) {
      const list = athletesByCategory.get(athlete.categoryId) ?? [];
      list.push({
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
      });
      athletesByCategory.set(athlete.categoryId, list);
    }
  }

  const allAthleteIds = Array.from(
    new Set(
      Array.from(athletesByCategory.values())
        .flat()
        .map((athlete) => athlete.id),
    ),
  );
  const consentEntries = await Promise.all(
    allAthleteIds.map(async (athleteId) => {
      const state = await resolveAthleteImageConsent(athleteId);
      return [athleteId, state] as const;
    }),
  );
  const consentByAthleteId = new Map(consentEntries);

  const reviewItems: MediaReviewItem[] = mediaItems.map((item) => {
    const categoryAthletes = athletesByCategory.get(item.categoryId) ?? [];
    return {
      id: item.id,
      title: item.title,
      mediaType: item.mediaType,
      categoryId: item.categoryId,
      categoryName: item.category.name,
      reviewStatus: item.reviewStatus,
      subjectsDeclaredComplete: item.subjectsDeclaredComplete,
      publishedAt: item.publishedAt ? item.publishedAt.toISOString() : null,
      mediaUrl: item.mediaUrl,
      filePath: item.filePath,
      selectedAthleteIds: item.subjects.map((subject) => subject.athleteId),
      athletes: categoryAthletes.map((athlete) => {
        const consent = consentByAthleteId.get(athlete.id);
        return {
          id: athlete.id,
          label: `${athlete.lastName} ${athlete.firstName}`,
          consentGranted: Boolean(consent?.granted),
          consentSource: consent?.source ?? "none",
        };
      }),
    };
  });

  const galleryItems = mediaItems
    .filter((item) => item.reviewStatus === "READY" && item.publishedAt)
    .map((item) => ({
      ...item,
      categoryName: item.category.name,
      createdByName: item.createdBy.name,
    }));

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <AreaHeader
          title="Media per categoria (Admin)"
          subtitle="Creazione, revisione consensi e pubblicazione controllata"
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

        <MediaReviewPanel items={reviewItems} />

        <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900">
            Galleria pubblicata verso i genitori
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Solo contenuti READY con pubblicazione attiva. I media storici non pubblicabili
            restano comunque nella coda di revisione sopra.
          </p>
          <div className="mt-4">
            <MediaGallery items={galleryItems} emptyMessage="Nessun media pubblicato." />
          </div>
        </section>
      </div>
    </main>
  );
}
