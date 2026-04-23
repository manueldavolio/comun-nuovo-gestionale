import { NextResponse } from "next/server";
import { AnnouncementAudience, Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuthSession } from "@/lib/auth";
import { createAnnouncementSchema } from "@/lib/validation/announcements";
import { parseDateInputToUTC } from "@/lib/date-input";
import { sendAnnouncementEmails } from "@/lib/mail";

type EmailSummary = {
  attempted: boolean;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedReason?: string;
};

async function resolveRecipientEmails(input: {
  audience: AnnouncementAudience;
  categoryId: string | null;
}) {
  if (input.audience === "CATEGORY_ONLY" && !input.categoryId) {
    return [] as string[];
  }

  const whereByAudience: Record<AnnouncementAudience, Prisma.UserWhereInput> = {
    ALL: {
      isActive: true,
      OR: [{ role: UserRole.PARENT }, { role: UserRole.COACH }],
    },
    PARENTS: {
      isActive: true,
      role: UserRole.PARENT,
    },
    COACHES: {
      isActive: true,
      role: UserRole.COACH,
    },
    CATEGORY_ONLY: {
      isActive: true,
      OR: [
        {
          role: UserRole.PARENT,
          parentProfile: {
            athletes: {
              some: {
                categoryId: input.categoryId!,
              },
            },
          },
        },
        {
          role: UserRole.COACH,
          coachProfile: {
            categoryAssignments: {
              some: {
                categoryId: input.categoryId!,
              },
            },
          },
        },
      ],
    },
  };

  const users = await prisma.user.findMany({
    where: whereByAudience[input.audience],
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

  const parsed = createAnnouncementSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const categoryId = parsed.data.categoryId?.trim() ? parsed.data.categoryId : null;
  if (categoryId) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ error: "Categoria non trovata." }, { status: 404 });
    }
  }

  const publishedAt =
    parsed.data.publishedAt && parsed.data.publishedAt.trim()
      ? parseDateInputToUTC(parsed.data.publishedAt)
      : new Date();

  if (!publishedAt) {
    return NextResponse.json({ error: "Data pubblicazione non valida." }, { status: 400 });
  }

  try {
    const created = await prisma.announcement.create({
      data: {
        title: parsed.data.title.trim(),
        content: parsed.data.content.trim(),
        audience: parsed.data.audience,
        categoryId,
        publishedAt,
        createdById: session.user.id,
      },
      select: { id: true },
    });

    let emailSummary: EmailSummary = {
      attempted: false,
      totalRecipients: 0,
      sentCount: 0,
      failedCount: 0,
    };

    if (parsed.data.sendEmail) {
      try {
        const recipients = await resolveRecipientEmails({
          audience: parsed.data.audience,
          categoryId,
        });
        const emailResult = await sendAnnouncementEmails({
          recipients,
          title: parsed.data.title,
          content: parsed.data.content,
        });

        if (emailResult.sent) {
          emailSummary = {
            attempted: true,
            totalRecipients: emailResult.totalRecipients,
            sentCount: emailResult.sentCount,
            failedCount: emailResult.failedCount,
          };
        } else {
          console.error("[announcements] Failed to send announcement emails", {
            announcementId: created.id,
            audience: parsed.data.audience,
            categoryId,
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
        console.error("[announcements] Unexpected error while sending announcement emails", {
          announcementId: created.id,
          audience: parsed.data.audience,
          categoryId,
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

    return NextResponse.json({ success: true, data: created, emailSummary }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Errore durante la creazione comunicazione." }, { status: 500 });
  }
}
