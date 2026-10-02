import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "YOUTH_DIRECTOR") {
    return NextResponse.json({ error: "Operazione non consentita." }, { status: 403 });
  }

  const requests = await prisma.parentAthleteLinkRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      requesterParent: {
        select: {
          firstName: true,
          lastName: true,
          phone: true,
          user: { select: { email: true, name: true } },
        },
      },
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          taxCode: true,
          parent: {
            select: {
              firstName: true,
              lastName: true,
              user: { select: { email: true } },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    success: true,
    data: requests.map((request) => ({
      id: request.id,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
      requester: {
        fullName: `${request.requesterParent.firstName} ${request.requesterParent.lastName}`.trim(),
        email: request.requesterParent.user.email,
        phone: request.requesterParent.phone,
      },
      athlete: {
        id: request.athlete.id,
        fullName: `${request.athlete.firstName} ${request.athlete.lastName}`.trim(),
        taxCode: request.athlete.taxCode,
      },
      primaryParent: {
        fullName: `${request.athlete.parent.firstName} ${request.athlete.parent.lastName}`.trim(),
        email: request.athlete.parent.user.email,
      },
    })),
  });
}
