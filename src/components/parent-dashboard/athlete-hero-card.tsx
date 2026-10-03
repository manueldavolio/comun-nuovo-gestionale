import { athleteInitials } from "@/lib/parent-season";

type AthleteHeroCardProps = {
  firstName: string;
  lastName: string;
  categoryName: string;
  position: string | null;
  shirtNumber: number | null;
  portraitUrl: string | null;
};

export function AthleteHeroCard({
  firstName,
  lastName,
  categoryName,
  position,
  shirtNumber,
  portraitUrl,
}: AthleteHeroCardProps) {
  const initials = athleteInitials(firstName, lastName);

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-blue-800 text-white shadow-md">
      <div className="flex items-center gap-4 p-5">
        {portraitUrl ? (
          // Portrait from enrollment document API (authenticated cookie request).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portraitUrl}
            alt={`${firstName} ${lastName}`}
            className="h-24 w-24 rounded-2xl border-2 border-white/40 object-cover shadow-sm"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-white/30 bg-blue-700 text-2xl font-bold tracking-wide shadow-sm">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">
            ASD Comun Nuovo
          </p>
          <h2 className="mt-1 truncate text-2xl font-bold leading-tight">
            {firstName} {lastName}
          </h2>
          <p className="mt-1 text-sm text-sky-100">{categoryName}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-3 py-1">
              {position?.trim() ? position : "Ruolo non impostato"}
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1">
              {shirtNumber != null ? `#${shirtNumber}` : "N. maglia —"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
