import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import {
  CONVOCATIONS_SCHEMA_MISSING_MESSAGE,
  isMissingConvocationsSchemaError,
} from "@/lib/convocations-db";
import { saveConvocationSchema } from "@/lib/validation/convocations";
import { canManageCategoryForConvocations } from "@/lib/convocations";
import { sendConvocationEmails } from "@/lib/mail";

type EmailSummary = {
  attempted: boolean;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedReason?: string;
};

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (
    session.user.role !== "ADMIN" &&
    session.user.role !== "YOUTH_DIRECTOR" &&
    session.user.role !== "COACH"
  ) {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = saveConvocationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const event = await prisma.event.findUnique({
    where: { id: parsed.data.eventId },
    select: {
      id: true,
      title: true,
      startAt: true,
      location: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!event || !event.categoryId || !event.category) {
    return NextResponse.json(
      { error: "Evento non trovato o non collegato a una categoria." },
      { status: 404 },
    );
  }
  const eventCategoryId = event.categoryId;

  const canManage = await canManageCategoryForConvocations({
    userId: session.user.id,
    role: session.user.role,
    categoryId: eventCategoryId,
  });

  if (!canManage) {
    return NextResponse.json({ error: "Non puoi gestire convocazioni per questa categoria." }, { status: 403 });
  }

  const categoryAthletes = await prisma.athlete.findMany({
    where: { categoryId: eventCategoryId },
    select: { id: true },
  });
  const categoryAthleteIds = new Set(categoryAthletes.map((athlete) => athlete.id));

  const hasInvalidAthlete = parsed.data.athleteIds.some((athleteId) => !categoryAthleteIds.has(athleteId));
  if (hasInvalidAthlete) {
    return NextResponse.json(
      { error: "Uno o piu atleti selezionati non appartengono alla categoria dell'evento." },
      { status: 400 },
    );
  }

  let convocationId = "";
  try {
    const savedConvocation = await prisma.$transaction(async (tx) => {
      const existingConvocation = await tx.convocation.findUnique({
        where: { eventId: event.id },
        select: { id: true },
      });

      if (existingConvocation) {
        await tx.convocation.update({
          where: { id: existingConvocation.id },
          data: {
            notes: parsed.data.notes || null,
          },
        });

        await tx.convocationAthlete.deleteMany({
          where: {
            convocationId: existingConvocation.id,
            athleteId: {
              notIn: parsed.data.athleteIds,
            },
          },
        });

        await tx.convocationAthlete.createMany({
          data: parsed.data.athleteIds.map((athleteId) => ({
            convocationId: existingConvocation.id,
            athleteId,
          })),
          skipDuplicates: true,
        });

        return { id: existingConvocation.id };
      }

      return tx.convocation.create({
        data: {
          eventId: event.id,
          categoryId: eventCategoryId,
          notes: parsed.data.notes || null,
          createdById: session.user.id,
          athletes: {
            createMany: {
              data: parsed.data.athleteIds.map((athleteId) => ({ athleteId })),
            },
          },
        },
        select: { id: true },
      });
    });

    convocationId = savedConvocation.id;
  } catch (error) {
    if (isMissingConvocationsSchemaError(error)) {
      return NextResponse.json({ error: CONVOCATIONS_SCHEMA_MISSING_MESSAGE }, { status: 503 });
    }
    return NextResponse.json({ error: "Errore durante il salvataggio convocazione." }, { status: 500 });
  }

  let emailSummary: EmailSummary = {
    attempted: false,
    totalRecipients: 0,
    sentCount: 0,
    failedCount: 0,
  };

  if (parsed.data.sendEmail) {
    try {
      const convocationAthletes = await prisma.convocationAthlete.findMany({
        where: { convocationId },
        select: {
          athlete: {
            select: {
              firstName: true,
              lastName: true,
              parent: {
                select: {
                  user: {
                    select: {
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const recipients = convocationAthletes.map((entry) => ({
        email: entry.athlete.parent.user.email,
        athleteFullName: `${entry.athlete.firstName} ${entry.athlete.lastName}`.trim(),
      }));

      const emailResult = await sendConvocationEmails({
        recipients,
        eventTitle: event.title,
        categoryName: event.category.name,
        startAt: event.startAt,
        location: event.location,
      });

      if (emailResult.sent) {
        emailSummary = {
          attempted: true,
          totalRecipients: emailResult.totalRecipients,
          sentCount: emailResult.sentCount,
          failedCount: emailResult.failedCount,
        };
      } else {
        emailSummary = {
          attempted: true,
          totalRecipients: recipients.length,
          sentCount: 0,
          failedCount: emailResult.skipped ? 0 : recipients.length,
          skippedReason: emailResult.reason,
        };
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Errore imprevisto durante invio email convocazioni.";
      if (isMissingConvocationsSchemaError(error)) {
        emailSummary = {
          attempted: true,
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          skippedReason: CONVOCATIONS_SCHEMA_MISSING_MESSAGE,
        };
        return NextResponse.json(
          {
            success: true,
            data: { convocationId, eventId: event.id },
            emailSummary,
          },
          { status: 200 },
        );
      }
      emailSummary = {
        attempted: true,
        totalRecipients: 0,
        sentCount: 0,
        failedCount: 0,
        skippedReason: reason,
      };
    }
  }

  return NextResponse.json(
    {
      success: true,
      data: { convocationId, eventId: event.id },
      emailSummary,
    },
    { status: 200 },
  );
}
