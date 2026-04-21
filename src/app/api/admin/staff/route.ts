import { randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildFullName } from "@/lib/staff";
import { upsertStaffSchema } from "@/lib/validation/staff";

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

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

  const firstName = parsed.data.firstName.trim();
  const lastName = parsed.data.lastName.trim();
  const email = parsed.data.email.toLowerCase().trim();
  const categoryIds = [...new Set(parsed.data.categoryIds)];
  const fullName = buildFullName(firstName, lastName);
  const passwordHash = await hash(randomUUID(), 12);

  if (categoryIds.length > 0) {
    const existingCategoryCount = await prisma.category.count({
      where: { id: { in: categoryIds } },
    });
    if (existingCategoryCount !== categoryIds.length) {
      return NextResponse.json({ error: "Una o piu categorie non esistono." }, { status: 400 });
    }
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: fullName,
          email,
          role: parsed.data.role,
          passwordHash,
        },
        select: { id: true },
      });

      const coachProfile = await tx.coachProfile.create({
        data: {
          userId: user.id,
          firstName,
          lastName,
          phone: "",
        },
        select: { id: true },
      });

      if (parsed.data.role === "ADMIN") {
        await tx.adminProfile.upsert({
          where: { userId: user.id },
          update: {
            firstName,
            lastName,
            phone: "",
          },
          create: {
            userId: user.id,
            firstName,
            lastName,
            phone: "",
          },
        });
      }

      if (categoryIds.length > 0) {
        await tx.coachCategoryAssignment.createMany({
          data: categoryIds.map((categoryId) => ({
            coachId: coachProfile.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      return user;
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Email gia utilizzata." }, { status: 409 });
    }
    return NextResponse.json({ error: "Errore durante la creazione membro staff." }, { status: 500 });
  }
}
