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
    <section className="relative overflow-hidden rounded-2xl border border-blue-700 bg-blue-800 text-white shadow-md">
      <div className="absolute inset-0 bg-blue-700/40" aria-hidden />
      <div className="absolute -right-6 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-sky-400/10" aria-hidden />
      {shirtNumber != null ? (
        <span
          className="pointer-events-none absolute -right-2 bottom-[-0.35em] select-none text-[7.5rem] font-black leading-none text-white/10 sm:text-[9rem]"
          aria-hidden
        >
          {shirtNumber}
        </span>
      ) : null}

      <div className="relative flex items-center gap-4 p-5 sm:gap-5 sm:p-6">
        {portraitUrl ? (
          // Portrait from enrollment document API (authenticated cookie request).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={portraitUrl}
            alt={`${firstName} ${lastName}`}
            className="h-28 w-28 shrink-0 rounded-2xl border-2 border-white/50 object-cover shadow-md sm:h-32 sm:w-32"
          />
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-2 border-white/40 bg-blue-700 text-3xl font-bold tracking-wide shadow-md sm:h-32 sm:w-32">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-home.png"
              alt=""
              className="h-8 w-8 rounded-full bg-white/95 object-contain p-0.5 shadow-sm sm:h-9 sm:w-9"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
                My Comun Nuovo
              </p>
              <p className="text-[10px] font-medium text-sky-200/80">ASD Comun Nuovo</p>
            </div>
          </div>

          <h2 className="mt-2 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            <span className="block truncate">{firstName}</span>
            <span className="block truncate text-sky-100">{lastName}</span>
          </h2>

          <p className="mt-2 text-sm font-medium text-sky-100">{categoryName}</p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1">
              {position?.trim() ? position : "Ruolo non impostato"}
            </span>
            <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1">
              {shirtNumber != null ? `Maglia #${shirtNumber}` : "N. maglia —"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
