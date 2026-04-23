import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import {
  CONVOCATIONS_SCHEMA_MISSING_MESSAGE,
  isMissingConvocationsSchemaError,
} from "@/lib/convocations-db";
import { prisma } from "@/lib/prisma";
import { respondConvocationSchema } from "@/lib/validation/convocations";

type RouteContext = {
  params: Promise<{ convocationAthleteId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "PARENT") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const { convocationAthleteId } = await context.params;
  if (!convocationAthleteId) {
    return NextResponse.json({ error: "Convocazione atleta non valida." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = respondConvocationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  let convocationAthlete:
    | {
        id: string;
        athlete: {
          parent: {
            userId: string;
          };
        };
      }
    | null = null;
  try {
    convocationAthlete = await prisma.convocationAthlete.findUnique({
      where: { id: convocationAthleteId },
      select: {
        id: true,
        athlete: {
          select: {
            parent: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });
  } catch (error) {
    if (isMissingConvocationsSchemaError(error)) {
      return NextResponse.json({ error: CONVOCATIONS_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: "Errore durante lettura convocazione." }, { status: 500 });
  }

  if (!convocationAthlete) {
    return NextResponse.json({ error: "Convocazione non trovata." }, { status: 404 });
  }

  if (convocationAthlete.athlete.parent.userId !== session.user.id) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  try {
    await prisma.convocationAthlete.update({
      where: { id: convocationAthleteId },
      data: {
        responseStatus: parsed.data.responseStatus,
        respondedAt: new Date(),
      },
    });
  } catch (error) {
    if (isMissingConvocationsSchemaError(error)) {
      return NextResponse.json({ error: CONVOCATIONS_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: "Errore durante il salvataggio risposta." }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
