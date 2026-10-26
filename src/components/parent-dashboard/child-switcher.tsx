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
    <div className="rounded-3xl border border-blue-100 bg-white/95 p-3.5 shadow-sm backdrop-blur">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
        I tuoi figli
      </p>
      <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {childrenOptions.map((child) => {
          const active = child.id === selectedId;
          return (
            <Link
              key={child.id}
              href={`/genitore?athleteId=${child.id}`}
              className={[
                "inline-flex min-h-12 shrink-0 items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                active
                  ? "border-blue-800 bg-blue-800 text-white shadow-md shadow-blue-900/20"
                  : "border-sky-100 bg-sky-50 text-blue-950 hover:border-sky-200 hover:bg-sky-100",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black",
                  active ? "bg-white/20 text-white" : "bg-blue-800 text-white",
                ].join(" ")}
              >
                {athleteInitials(child.firstName, child.lastName)}
              </span>
              <span className="pr-1">
                {child.firstName}
                <span
                  className={[
                    "ml-1 font-semibold",
                    active ? "text-sky-100" : "text-zinc-500",
                  ].join(" ")}
                >
                  {child.lastName}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
