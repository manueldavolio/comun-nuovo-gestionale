import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { deleteAthleteAsAdmin } from "@/lib/admin-athlete-delete";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ athleteId: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { athleteId } = await context.params;
  if (!athleteId?.trim()) {
    return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
  }

  const result = await deleteAthleteAsAdmin({
    athleteId,
    prisma,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    message: "Atleta eliminato correttamente.",
    data: {
      athleteId: result.athleteId,
      firstName: result.firstName,
      lastName: result.lastName,
      leftoverStoragePaths: result.leftoverStoragePaths,
      storageCleanup: result.storageCleanup,
    },
  });
}
