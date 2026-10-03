import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Athlete is associated if primary parentId OR AthleteParent link exists. */
export function athletesAssociatedToParentWhere(
  parentProfileId: string,
): Prisma.AthleteWhereInput {
  return {
    OR: [
      { parentId: parentProfileId },
      { additionalParents: { some: { parentId: parentProfileId } } },
    ],
  };
}

/** Parents linked to athletes in a category (primary OR additional). */
export function parentUsersLinkedToCategoryWhere(categoryId: string): Prisma.UserWhereInput {
  return {
    role: "PARENT",
    isActive: true,
    parentProfile: {
      OR: [
        {
          athletes: {
            some: { categoryId },
          },
        },
        {
          additionalAthleteLinks: {
            some: {
              athlete: { categoryId },
            },
          },
        },
      ],
    },
  };
}

export function normalizeAthleteTaxCode(taxCode: string): string {
  return taxCode.trim().toUpperCase().replace(/\s+/g, "");
}

export function birthDatesMatchUtc(stored: Date, input: Date): boolean {
  return (
    stored.getUTCFullYear() === input.getUTCFullYear() &&
    stored.getUTCMonth() === input.getUTCMonth() &&
    stored.getUTCDate() === input.getUTCDate()
  );
}

export async function getParentProfileIdForUser(userId: string): Promise<string | null> {
  const profile = await prisma.parentProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  return profile?.id ?? null;
}

export async function getAssociatedAthleteIdsForParent(
  parentProfileId: string,
): Promise<string[]> {
  const athletes = await prisma.athlete.findMany({
    where: athletesAssociatedToParentWhere(parentProfileId),
    select: { id: true },
  });
  return athletes.map((athlete) => athlete.id);
}

export async function isParentAssociatedToAthlete(options: {
  parentProfileId: string;
  athleteId: string;
}): Promise<boolean> {
  const athlete = await prisma.athlete.findFirst({
    where: {
      id: options.athleteId,
      ...athletesAssociatedToParentWhere(options.parentProfileId),
    },
    select: { id: true },
  });
  return Boolean(athlete);
}

export async function assertUserParentAssociatedToAthlete(options: {
  userId: string;
  athleteId: string;
}): Promise<{ ok: true; parentProfileId: string } | { ok: false }> {
  const parentProfileId = await getParentProfileIdForUser(options.userId);
  if (!parentProfileId) {
    return { ok: false };
  }

  const associated = await isParentAssociatedToAthlete({
    parentProfileId,
    athleteId: options.athleteId,
  });

  if (!associated) {
    return { ok: false };
  }

  return { ok: true, parentProfileId };
}

/** Pagamenti/ricevute: solo genitore principale (Athlete.parentId). */
export async function isPrimaryParentOfAthlete(options: {
  parentProfileId: string;
  athleteId: string;
}): Promise<boolean> {
  const athlete = await prisma.athlete.findFirst({
    where: {
      id: options.athleteId,
      parentId: options.parentProfileId,
    },
    select: { id: true },
  });
  return Boolean(athlete);
}

export async function assertUserPrimaryParentOfAthlete(options: {
  userId: string;
  athleteId: string;
}): Promise<{ ok: true; parentProfileId: string } | { ok: false }> {
  const parentProfileId = await getParentProfileIdForUser(options.userId);
  if (!parentProfileId) {
    return { ok: false };
  }

  const isPrimary = await isPrimaryParentOfAthlete({
    parentProfileId,
    athleteId: options.athleteId,
  });

  if (!isPrimary) {
    return { ok: false };
  }

  return { ok: true, parentProfileId };
}

export type AssociatedParentContact = {
  parentProfileId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  isPrimary: boolean;
};

/** Primary parent + additional AthleteParent links (deduped by parentProfileId). */
export async function listAssociatedParentsForAthlete(
  athleteId: string,
): Promise<AssociatedParentContact[]> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      parentId: true,
      parent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          user: { select: { email: true, isActive: true } },
        },
      },
      additionalParents: {
        select: {
          parent: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              user: { select: { email: true, isActive: true } },
            },
          },
        },
      },
    },
  });

  if (!athlete) {
    return [];
  }

  const byId = new Map<string, AssociatedParentContact>();

  if (athlete.parent.user.isActive) {
    byId.set(athlete.parent.id, {
      parentProfileId: athlete.parent.id,
      firstName: athlete.parent.firstName,
      lastName: athlete.parent.lastName,
      phone: athlete.parent.phone,
      email: athlete.parent.user.email,
      isPrimary: true,
    });
  }

  for (const link of athlete.additionalParents) {
    if (!link.parent.user.isActive) {
      continue;
    }
    if (byId.has(link.parent.id)) {
      continue;
    }
    byId.set(link.parent.id, {
      parentProfileId: link.parent.id,
      firstName: link.parent.firstName,
      lastName: link.parent.lastName,
      phone: link.parent.phone,
      email: link.parent.user.email,
      isPrimary: false,
    });
  }

  return [...byId.values()];
}

export function dedupeByNormalizedKey<T>(
  items: T[],
  getKey: (item: T) => string | null,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const raw = getKey(item);
    if (!raw) {
      continue;
    }
    const key = raw.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

export async function approveParentAthleteLinkRequest(options: {
  requestId: string;
  reviewerUserId: string;
}): Promise<
  | { ok: true; alreadyLinked: boolean }
  | { ok: false; status: 404 | 409; error: string }
> {
  const request = await prisma.parentAthleteLinkRequest.findUnique({
    where: { id: options.requestId },
    select: {
      id: true,
      status: true,
      requesterParentId: true,
      athleteId: true,
    },
  });

  if (!request) {
    return { ok: false, status: 404, error: "Richiesta non trovata." };
  }

  if (request.status === "APPROVED") {
    const already = await isParentAssociatedToAthlete({
      parentProfileId: request.requesterParentId,
      athleteId: request.athleteId,
    });
    if (!already) {
      await prisma.athleteParent.create({
        data: {
          athleteId: request.athleteId,
          parentId: request.requesterParentId,
        },
      });
    }
    return { ok: true, alreadyLinked: already };
  }

  if (request.status === "REJECTED") {
    return { ok: false, status: 409, error: "Richiesta già rifiutata." };
  }

  const alreadyLinked = await isParentAssociatedToAthlete({
    parentProfileId: request.requesterParentId,
    athleteId: request.athleteId,
  });

  await prisma.$transaction(async (tx) => {
    if (!alreadyLinked) {
      await tx.athleteParent.create({
        data: {
          athleteId: request.athleteId,
          parentId: request.requesterParentId,
        },
      });
    }

    await tx.parentAthleteLinkRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: options.reviewerUserId,
      },
    });
  });

  return { ok: true, alreadyLinked };
}

export async function rejectParentAthleteLinkRequest(options: {
  requestId: string;
  reviewerUserId: string;
}): Promise<{ ok: true } | { ok: false; status: 404 | 409; error: string }> {
  const request = await prisma.parentAthleteLinkRequest.findUnique({
    where: { id: options.requestId },
    select: { id: true, status: true },
  });

  if (!request) {
    return { ok: false, status: 404, error: "Richiesta non trovata." };
  }

  if (request.status === "REJECTED") {
    return { ok: true };
  }

  if (request.status === "APPROVED") {
    return { ok: false, status: 409, error: "Richiesta già approvata." };
  }

  await prisma.parentAthleteLinkRequest.update({
    where: { id: request.id },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedById: options.reviewerUserId,
    },
  });

  return { ok: true };
}
