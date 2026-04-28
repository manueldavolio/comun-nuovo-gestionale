import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { getCoachCategoryIdsForUser } from "@/lib/attendance";

type RouteContext = {
  params: Promise<{
    announcementId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const role = session.user.role;
  const canDeleteAny = role === "ADMIN" || role === "YOUTH_DIRECTOR";
  const canDeleteOwnCategory = role === "COACH";

  if (!canDeleteAny && !canDeleteOwnCategory) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { announcementId } = await context.params;
  if (!announcementId) {
    return NextResponse.json({ error: "ID comunicazione non valido." }, { status: 400 });
  }

  const announcement = await prisma.announcement.findUnique({
    where: { id: announcementId },
    select: {
      id: true,
      categoryId: true,
    },
  });

  if (!announcement) {
    return NextResponse.json({ error: "Comunicazione non trovata." }, { status: 404 });
  }

  if (canDeleteOwnCategory) {
    if (!announcement.categoryId) {
      return NextResponse.json(
        { error: "Puoi eliminare solo comunicazioni collegate alle tue categorie." },
        { status: 403 },
      );
    }

    const coachCategoryIds = await getCoachCategoryIdsForUser(session.user.id);
    if (!coachCategoryIds.includes(announcement.categoryId)) {
      return NextResponse.json(
        { error: "Puoi eliminare solo comunicazioni collegate alle tue categorie." },
        { status: 403 },
      );
    }
  }

  try {
    await prisma.announcement.delete({
      where: {
        id: announcement.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore durante l'eliminazione della comunicazione." },
      { status: 500 },
    );
  }
}
