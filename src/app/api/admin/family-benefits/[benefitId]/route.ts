import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSiteWebAdminApi } from "@/lib/site-cms-server";
import { upsertFamilyBenefitSchema } from "@/lib/validation/family-benefits";

type RouteContext = { params: Promise<{ benefitId: string }> };

export async function PUT(request: Request, context: RouteContext) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) return errorResponse;
  const { benefitId } = await context.params;

  const payload = await request.json().catch(() => null);
  const parsed = upsertFamilyBenefitSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dati non validi." },
      { status: 400 },
    );
  }

  try {
    await prisma.familyBenefit.update({
      where: { id: benefitId },
      data: {
        ...parsed.data,
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Convenzione non trovata." }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { errorResponse } = await requireSiteWebAdminApi();
  if (errorResponse) return errorResponse;
  const { benefitId } = await context.params;
  try {
    await prisma.familyBenefit.delete({ where: { id: benefitId } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Convenzione non trovata." }, { status: 404 });
  }
}
