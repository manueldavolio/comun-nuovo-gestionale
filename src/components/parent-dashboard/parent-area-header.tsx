import Link from "next/link";
import { SignOutButton } from "@/components/auth/sign-out-button";

type ParentAreaHeaderProps = {
  title: string;
  subtitle: string;
  userName: string;
  backHref?: string;
  backLabel?: string;
};

export function ParentAreaHeader({
  title,
  subtitle,
  userName,
  backHref,
  backLabel = "Dashboard",
}: ParentAreaHeaderProps) {
  return (
    <header className="overflow-hidden rounded-3xl border border-blue-200/80 bg-gradient-to-br from-blue-900 via-blue-800 to-sky-700 text-white shadow-lg shadow-blue-900/15">
      <div className="relative px-4 py-4 sm:px-5 sm:py-5">
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-sky-400/20 blur-2xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-12 left-1/3 h-28 w-28 rounded-full bg-white/10 blur-xl"
          aria-hidden
        />

        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-home.png"
              alt="ASD Comun Nuovo"
              className="h-12 w-12 shrink-0 rounded-2xl bg-white object-contain p-1 shadow-md sm:h-14 sm:w-14"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
                ASD Comun Nuovo
              </p>
              <h1 className="mt-0.5 text-xl font-black tracking-tight sm:text-2xl">{title}</h1>
              <p className="mt-1 text-sm font-medium text-sky-100/95">
                {subtitle}
                <span className="text-sky-200/80"> · {userName}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {backHref ? (
              <Link
                href={backHref}
                className="inline-flex min-h-11 items-center rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                ← {backLabel}
              </Link>
            ) : null}
            <Link
              href="/account/password"
              className="inline-flex min-h-11 items-center rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
            >
              Password
            </Link>
            <SignOutButton className="inline-flex min-h-11 items-center rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20" />
          </div>
        </div>
      </div>
    </header>
  );
}
