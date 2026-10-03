import Link from "next/link";
import { athleteInitials } from "@/lib/parent-season";

type ChildOption = {
  id: string;
  firstName: string;
  lastName: string;
};

export function ParentChildSwitcher({
  childrenOptions,
  selectedId,
}: {
  childrenOptions: ChildOption[];
  selectedId: string;
}) {
  if (childrenOptions.length <= 1) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-white/90 p-3 shadow-sm backdrop-blur-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-800">
        Seleziona figlio
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {childrenOptions.map((child) => {
          const active = child.id === selectedId;
          return (
            <Link
              key={child.id}
              href={`/genitore?athleteId=${child.id}`}
              className={[
                "inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                active
                  ? "border-blue-700 bg-blue-700 text-white shadow-sm"
                  : "border-blue-100 bg-sky-50 text-blue-900 hover:bg-sky-100",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                  active ? "bg-white/20 text-white" : "bg-blue-100 text-blue-800",
                ].join(" ")}
              >
                {athleteInitials(child.firstName, child.lastName)}
              </span>
              {child.firstName}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
