import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { upsertFamilyBenefitSchema } from "@/lib/validation/family-benefits";

export async function GET() {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) return errorResponse;

  const rows = await prisma.familyBenefit.findMany({
    orderBy: [{ priority: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) return errorResponse;

  const payload = await request.json().catch(() => null);
  const parsed = upsertFamilyBenefitSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  const created = await prisma.familyBenefit.create({
    data: {
      ...parsed.data,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
    select: { id: true },
  });
  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
