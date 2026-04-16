import type { MedicalVisitStatus } from "@prisma/client";
import { computeMedicalVisitStatusForReminder } from "@/lib/expiry-status";
import { prisma } from "@/lib/prisma";

export type MedicalVisitReminderTarget = {
  visitId: string;
  athleteId: string;
  athleteFullName: string;
  categoryName: string;
  expiryDate: Date;
  status: MedicalVisitStatus;
  parentEmail: string | null;
};

export type MedicalVisitReminderTargets = {
  expiring: MedicalVisitReminderTarget[];
  expired: MedicalVisitReminderTarget[];
  all: MedicalVisitReminderTarget[];
};

export async function getMedicalVisitReminderTargets({
  now = new Date(),
}: {
  now?: Date;
} = {}): Promise<MedicalVisitReminderTargets> {
  const athletes = await prisma.athlete.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      category: {
        select: {
          name: true,
        },
      },
      parent: {
        select: {
          user: {
            select: {
              email: true,
            },
          },
        },
      },
      medicalVisits: {
        orderBy: { visitDate: "desc" },
        take: 1,
        select: {
          id: true,
          visitDate: true,
          expiryDate: true,
        },
      },
    },
  });

  const targets: MedicalVisitReminderTarget[] = athletes.flatMap((athlete) => {
    const latest = athlete.medicalVisits[0];
    if (!latest) return [];

    const status = computeMedicalVisitStatusForReminder(latest.expiryDate, now);
    if (status !== "EXPIRING" && status !== "EXPIRED") return [];

    return [
      {
        visitId: latest.id,
        athleteId: athlete.id,
        athleteFullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
        categoryName: athlete.category.name,
        expiryDate: latest.expiryDate,
        status,
        parentEmail: athlete.parent.user?.email ?? null,
      },
    ];
  });

  const expiring = targets
    .filter((t) => t.status === "EXPIRING")
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());
  const expired = targets
    .filter((t) => t.status === "EXPIRED")
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());

  return { expiring, expired, all: targets };
}

