import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildFullName, STAFF_ROLE_OPTIONS } from "@/lib/staff";
import { upsertStaffSchema } from "@/lib/validation/staff";

export async function PUT(
  request: Request,
  context: { params: Promise<{ staffId: string }> },
) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { staffId } = await context.params;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = upsertStaffSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const staffUser = await prisma.user.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      role: true,
    },
  });

  if (!staffUser) {
    return NextResponse.json({ error: "Membro staff non trovato." }, { status: 404 });
  }

  if (!STAFF_ROLE_OPTIONS.includes(staffUser.role)) {
    return NextResponse.json({ error: "L'utente selezionato non appartiene allo staff tecnico." }, { status: 400 });
  }

  const firstName = parsed.data.firstName.trim();
  const lastName = parsed.data.lastName.trim();
  const email = parsed.data.email.toLowerCase().trim();
  const categoryIds = [...new Set(parsed.data.categoryIds)];
  const fullName = buildFullName(firstName, lastName);

  if (categoryIds.length > 0) {
    const existingCategoryCount = await prisma.category.count({
      where: { id: { in: categoryIds } },
    });
    if (existingCategoryCount !== categoryIds.length) {
      return NextResponse.json({ error: "Una o piu categorie non esistono." }, { status: 400 });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: staffId },
        data: {
          name: fullName,
          email,
          role: parsed.data.role,
        },
      });

      const coachProfile = await tx.coachProfile.upsert({
        where: { userId: staffId },
        update: {
          firstName,
          lastName,
        },
        create: {
          userId: staffId,
          firstName,
          lastName,
          phone: "",
        },
        select: { id: true },
      });

      if (parsed.data.role === "ADMIN") {
        await tx.adminProfile.upsert({
          where: { userId: staffId },
          update: {
            firstName,
            lastName,
            phone: "",
          },
          create: {
            userId: staffId,
            firstName,
            lastName,
            phone: "",
          },
        });
      }

      await tx.coachCategoryAssignment.deleteMany({
        where: {
          coachId: coachProfile.id,
        },
      });

      if (categoryIds.length > 0) {
        await tx.coachCategoryAssignment.createMany({
          data: categoryIds.map((categoryId) => ({
            coachId: coachProfile.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email gia utilizzata." }, { status: 409 });
    }
    return NextResponse.json({ error: "Errore durante l'aggiornamento membro staff." }, { status: 500 });
  }
}
