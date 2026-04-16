import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { sendMedicalVisitExpirationReminders } from "@/lib/medical-visits/reminders/send";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  // Richiesta esplicitamente: solo ADMIN può lanciare i promemoria.
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const body = (payload ?? {}) as Partial<{
    includeExpiring: boolean;
    includeExpired: boolean;
  }>;

  try {
    const summary = await sendMedicalVisitExpirationReminders({
      includeExpiring: body.includeExpiring ?? true,
      includeExpired: body.includeExpired ?? true,
    });

    return NextResponse.json({ success: true, summary }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore imprevisto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

