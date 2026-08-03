import Link from "next/link";
import { redirect } from "next/navigation";
import { AreaHeader } from "@/components/layout/area-header";
import { EditEventForm } from "@/components/events/edit-event-form";
import { getAuthSession } from "@/lib/auth";
import { toDateTimeLocalValueUTC } from "@/lib/date-input";
import { ROLE_HOME_PATH } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

type AdminEditEventPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditEventPage({ params }: AdminEditEventPageProps) {
  const { id } = await params;
  const session = await getAuthSession();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/admin/eventi/${id}/modifica`);
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    redirect(ROLE_HOME_PATH[session.user.role] ?? "/unauthorized");
  }

  const [event, categories] = await Promise.all([
    prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        type: true,
        startAt: true,
        location: true,
        description: true,
        categoryId: true,
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        birthYearsLabel: true,
      },
    }),
  ]);

  if (!event || !event.categoryId) {
    redirect("/admin");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-blue-100 p-4 md:p-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <AreaHeader
          title="Modifica evento"
          subtitle={event.title}
          userName={session.user.name ?? "Staff"}
        />

        <Link
          href="/admin"
          className="inline-flex w-fit items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
        >
          Torna alla dashboard
        </Link>

        <EditEventForm
          eventId={event.id}
          categories={categories}
          redirectTo="/admin"
          initialValues={{
            title: event.title,
            type: event.type,
            startAt: toDateTimeLocalValueUTC(event.startAt),
            location: event.location ?? "",
            categoryId: event.categoryId,
            notes: event.description ?? "",
          }}
        />
      </div>
    </main>
  );
}
