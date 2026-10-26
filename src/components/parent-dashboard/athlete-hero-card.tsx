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
    <section className="relative overflow-hidden rounded-3xl border border-blue-700/40 bg-gradient-to-br from-blue-950 via-blue-800 to-sky-600 text-white shadow-xl shadow-blue-900/20">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 85% 20%, rgba(125,211,252,0.35), transparent 42%), radial-gradient(circle at 10% 90%, rgba(255,255,255,0.12), transparent 40%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-blue-950/50 to-transparent"
        aria-hidden
      />
      {shirtNumber != null ? (
        <span
          className="pointer-events-none absolute -right-1 bottom-[-0.4em] select-none text-[8rem] font-black leading-none text-white/10 sm:text-[10rem]"
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
            className="h-28 w-28 shrink-0 rounded-[1.35rem] border-2 border-white/60 object-cover shadow-lg sm:h-32 sm:w-32"
          />
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-[1.35rem] border-2 border-white/45 bg-blue-700/80 text-3xl font-black tracking-wide shadow-lg sm:h-32 sm:w-32">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-home.png"
              alt=""
              className="h-9 w-9 rounded-full bg-white object-contain p-0.5 shadow-md sm:h-10 sm:w-10"
            />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-sky-200">
                My Comun Nuovo
              </p>
              <p className="text-[11px] font-medium text-sky-100/85">Area famiglia</p>
            </div>
          </div>

          <h2 className="mt-2.5 text-2xl font-black leading-[1.05] tracking-tight sm:text-3xl">
            <span className="block truncate">{firstName}</span>
            <span className="block truncate text-sky-100">{lastName}</span>
          </h2>

          <p className="mt-2 text-sm font-semibold text-sky-100">{categoryName}</p>

          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1.5 backdrop-blur-sm">
              {position?.trim() ? position : "Ruolo non impostato"}
            </span>
            <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1.5 backdrop-blur-sm">
              {shirtNumber != null ? `Maglia #${shirtNumber}` : "N. maglia —"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
