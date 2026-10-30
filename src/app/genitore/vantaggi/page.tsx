import Link from "next/link";
import { redirect } from "next/navigation";
import { ParentAreaHeader } from "@/components/parent-dashboard/parent-area-header";
import { getAuthSession } from "@/lib/auth";
import {
  FAMILY_BENEFIT_AUDIENCE_LABEL,
  isFamilyBenefitVisibleToAudience,
  sortFamilyBenefits,
} from "@/lib/family-benefits";
import { athletesAssociatedToParentWhere } from "@/lib/parent-athletes";
import { prisma } from "@/lib/prisma";

type Props = { searchParams: Promise<{ athleteId?: string }> };

export default async function ParentVantaggiPage({ searchParams }: Props) {
  const session = await getAuthSession();
  if (!session?.user?.id || session.user.role !== "PARENT") {
    redirect("/login?callbackUrl=/genitore/vantaggi");
  }

  const parentProfile = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!parentProfile) redirect("/genitore");

  const params = await searchParams;
  const athletes = await prisma.athlete.findMany({
    where: athletesAssociatedToParentWhere(parentProfile.id),
    select: {
      id: true,
      firstName: true,
      category: { select: { name: true, sector: true } },
    },
    orderBy: { firstName: "asc" },
  });
  const selected =
    athletes.find((a) => a.id === (params.athleteId ?? "").trim()) ?? athletes[0] ?? null;

  const allBenefits = await prisma.familyBenefit.findMany();
  const visible = selected
    ? sortFamilyBenefits(
        allBenefits.filter((b) =>
          isFamilyBenefitVisibleToAudience({
            audience: b.audience,
            isPublished: b.isPublished,
            isActive: b.isActive,
            expiresAt: b.expiresAt,
            viewer: {
              categoryName: selected.category.name,
              sector: selected.category.sector,
            },
          }),
        ),
      )
    : [];

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100 via-slate-50 to-blue-100/60 p-4 pb-10 md:p-8">
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-4">
        <ParentAreaHeader
          title="Vantaggi per le famiglie"
          subtitle={
            selected
              ? `Convenzioni per ${selected.firstName} · ${selected.category.name}`
              : "Convenzioni societarie"
          }
          userName={session.user.name ?? "Genitore"}
          backHref={selected ? `/genitore?athleteId=${selected.id}` : "/genitore"}
        />

        {visible.length === 0 ? (
          <section className="rounded-2xl border border-blue-100 bg-white p-5 text-sm text-zinc-600 shadow-sm">
            Al momento non ci sono convenzioni attive per questa categoria.
          </section>
        ) : (
          <ul className="space-y-3">
            {visible.map((benefit) => (
              <li
                key={benefit.id}
                className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm"
              >
                <div className="flex gap-3">
                  {benefit.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={benefit.logoUrl}
                      alt=""
                      className="h-14 w-14 rounded-xl border border-sky-100 object-contain bg-sky-50 p-1"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-800 text-xs font-bold text-white">
                      CN
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-blue-950">{benefit.name}</p>
                    {benefit.businessName ? (
                      <p className="text-xs font-semibold text-zinc-500">{benefit.businessName}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-zinc-700">{benefit.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      {benefit.discountLabel ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">
                          {benefit.discountLabel}
                        </span>
                      ) : null}
                      {benefit.promoCode ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 font-mono font-bold text-blue-900">
                          {benefit.promoCode}
                        </span>
                      ) : null}
                      <span className="rounded-full bg-zinc-50 px-2 py-0.5 text-zinc-600">
                        {FAMILY_BENEFIT_AUDIENCE_LABEL[benefit.audience]}
                      </span>
                    </div>
                    {benefit.conditions ? (
                      <p className="mt-2 text-xs text-zinc-500">{benefit.conditions}</p>
                    ) : null}
                    {benefit.contactInfo ? (
                      <p className="mt-1 text-xs text-zinc-600">Contatti: {benefit.contactInfo}</p>
                    ) : null}
                    {benefit.websiteUrl ? (
                      <a
                        href={benefit.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex text-xs font-bold text-blue-800 underline"
                      >
                        Apri sito partner
                      </a>
                    ) : null}
                    {benefit.expiresAt ? (
                      <p className="mt-2 text-[11px] text-zinc-400">
                        Valida fino al{" "}
                        {benefit.expiresAt.toLocaleDateString("it-IT")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Link href={selected ? `/genitore?athleteId=${selected.id}` : "/genitore"} className="text-sm font-bold text-blue-800">
          ← Torna alla dashboard
        </Link>
      </div>
    </main>
  );
}
