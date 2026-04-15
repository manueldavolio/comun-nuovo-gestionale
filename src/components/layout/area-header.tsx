import { SignOutButton } from "@/components/auth/sign-out-button";

type AreaHeaderProps = {
  title: string;
  subtitle: string;
  userName: string;
};

export function AreaHeader({ title, subtitle, userName }: AreaHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
          Comun Nuovo Calcio
        </p>
        <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
        <p className="text-sm text-zinc-600">
          {subtitle} - {userName}
        </p>
      </div>
      <SignOutButton />
    </header>
  );
}
