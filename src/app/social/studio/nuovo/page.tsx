import { redirect } from "next/navigation";
import { StudioNewWizard } from "@/components/social-studio/studio-new-wizard";
import { getAuthSession } from "@/lib/auth";
import { formatYearMonth, currentCalendarMonthStart } from "@/lib/calendar-range";
import { canUseSocialStudio } from "@/lib/permissions";
import { listStudioMatches } from "@/lib/social-studio/queries";

export default async function SocialStudioNewPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/social/studio/nuovo");
  }
  if (!canUseSocialStudio(session.user.role)) {
    redirect("/unauthorized");
  }

  const month = formatYearMonth(currentCalendarMonthStart());
  const data = await listStudioMatches({ month });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50">
      <StudioNewWizard
        initialMonth={data.month}
        initialMatches={data.matches}
        categories={data.categories}
      />
    </main>
  );
}
