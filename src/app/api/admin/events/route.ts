import { NextResponse } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { createEventSchema } from "@/lib/validation/events";
import { sendEventEmails } from "@/lib/mail";

type EmailSummary = {
  attempted: boolean;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedReason?: string;
};

async function resolveCategoryEventRecipientEmails(categoryId: string) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        {
          role: UserRole.PARENT,
          parentProfile: {
            athletes: {
              some: {
                categoryId,
              },
            },
          },
        },
        {
          role: UserRole.COACH,
          coachProfile: {
            categoryAssignments: {
              some: {
                categoryId,
              },
            },
          },
        },
      ],
    } satisfies Prisma.UserWhereInput,
    select: {
      email: true,
    },
  });

  return users.map((user) => user.email);
}

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  const parsed = createEventSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true, name: true },
  });

  if (!category) {
    return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
  }

  const startAt = new Date(parsed.data.startAt);

  try {
    const createdEvent = await prisma.event.create({
      data: {
        title: parsed.data.title,
        type: parsed.data.type,
        startAt,
        location: parsed.data.location || null,
        description: parsed.data.notes || null,
        categoryId: category.id,
        createdById: session.user.id,
      },
      select: { id: true, categoryId: true },
    });

    let emailSummary: EmailSummary = {
      attempted: false,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
    };

    if (parsed.data.sendEmail && createdEvent.categoryId) {
      try {
        const recipients = await resolveCategoryEventRecipientEmails(createdEvent.categoryId);
        const emailResult = await sendEventEmails({
          recipients,
          title: parsed.data.title,
          type: parsed.data.type,
          categoryName: category.name,
          startAt,
          location: parsed.data.location,
          notes: parsed.data.notes,
        });

        if (emailResult.sent) {
          emailSummary = {
            attempted: true,
            totalRecipients: emailResult.totalRecipients,
            sentCount: emailResult.sentCount,
            failedCount: emailResult.failedCount,
          };
        } else {
          console.error("[events] Failed to send event emails", {
            eventId: createdEvent.id,
            categoryId: createdEvent.categoryId,
            reason: emailResult.reason,
          });
          emailSummary = {
            attempted: true,
            totalRecipients: recipients.length,
            sentCount: 0,
            failedCount: emailResult.skipped ? 0 : recipients.length,
            skippedReason: emailResult.reason,
          };
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Errore imprevisto durante invio email.";
        console.error("[events] Unexpected error while sending event emails", {
          eventId: createdEvent.id,
          categoryId: createdEvent.categoryId,
          reason,
        });
        emailSummary = {
          attempted: true,
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          skippedReason: reason,
        };
      }
    }

    return NextResponse.json({ success: true, data: createdEvent, emailSummary }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante la creazione evento." }, { status: 500 });
  }
}
