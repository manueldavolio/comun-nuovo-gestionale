import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  approveParentAthleteLinkRequest,
  rejectParentAthleteLinkRequest,
} from "@/lib/parent-athletes";
import { reviewParentAthleteLinkRequestSchema } from "@/lib/validation/parent-athlete-links";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { requestId } = await context.params;
  if (!requestId) {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = reviewParentAthleteLinkRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  if (parsed.data.action === "APPROVE") {
    const result = await approveParentAthleteLinkRequest({
      requestId,
      reviewerUserId: session.user.id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      success: true,
      message: result.alreadyLinked
        ? "Richiesta già collegata; stato aggiornato."
        : "Associazione approvata.",
    });
  }

  const result = await rejectParentAthleteLinkRequest({
    requestId,
    reviewerUserId: session.user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true, message: "Richiesta rifiutata." });
}
