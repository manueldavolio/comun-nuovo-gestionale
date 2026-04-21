import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { upsertCategorySchema } from "@/lib/validation/categories";

function getDefaultSeasonLabel(now = new Date()): string {
  const year = now.getFullYear();
  return `${year}/${year + 1}`;
}

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

  const parsed = upsertCategorySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  try {
    const created = await prisma.category.create({
      data: {
        name: parsed.data.name.trim(),
        birthYearsLabel: parsed.data.birthYearsLabel.trim(),
        seasonLabel: getDefaultSeasonLabel(),
        annualFee: new Prisma.Decimal("0"),
        depositFee: new Prisma.Decimal("0"),
        balanceFee: new Prisma.Decimal("0"),
        isActive: parsed.data.isActive,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Esiste gia una categoria con lo stesso nome per la stagione corrente." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Errore durante la creazione categoria." }, { status: 500 });
  }
}
