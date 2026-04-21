import Link from "next/link";

type AdminBackLinkProps = {
  href?: string;
  label?: string;
  className?: string;
};

export function AdminBackLink({
  href = "/admin",
  label = "← Torna alla dashboard",
  className = "",
}: AdminBackLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 ${className}`.trim()}
    >
      {label}
    </Link>
  );
}
