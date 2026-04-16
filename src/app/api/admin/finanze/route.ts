import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { parseDateInputToUTC } from "@/lib/date-input";
import { prisma } from "@/lib/prisma";
import { createFinanceEntrySchema } from "@/lib/validation/finance";

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

  const parsed = createFinanceEntrySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const parsedDate = parseDateInputToUTC(parsed.data.date);
  if (!parsedDate) {
    return NextResponse.json({ error: "Data non valida." }, { status: 400 });
  }

  try {
    const created = await prisma.accountingEntry.create({
      data: {
        type: parsed.data.type,
        category: parsed.data.category,
        amount: parsed.data.amount,
        description: parsed.data.description,
        date: parsedDate,
        isForecast: parsed.data.isForecast,
        createdById: session.user.id,
      },
      select: { id: true },
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante il salvataggio del movimento." }, { status: 500 });
  }
}
