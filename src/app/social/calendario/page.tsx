import { redirect } from "next/navigation";
import { SocialMatchesCalendar } from "@/components/social/social-matches-calendar";
import { getAuthSession } from "@/lib/auth";
import { formatYearMonth, currentCalendarMonthStart } from "@/lib/calendar-range";
import { canUseSocialStudio } from "@/lib/permissions";
import { listSocialMatches } from "@/lib/social-matches-queries";

export default async function SocialMatchesCalendarPage() {
  const session = await getAuthSession();
  if (!session?.user) {
    redirect("/login?callbackUrl=/social/calendario");
  }
  if (!canUseSocialStudio(session.user.role)) {
    redirect("/unauthorized");
  }

  const month = formatYearMonth(currentCalendarMonthStart());
  const data = await listSocialMatches({ month });

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-blue-50 p-3 sm:p-6">
      <SocialMatchesCalendar
        initialMonth={data.month}
        initialMatches={data.matches}
        categories={data.categories}
        userName={session.user.name ?? "Social Media"}
      />
    </main>
  );
}
