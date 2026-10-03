"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type ParentAdminPanelProps = {
  summaryText: string;
  hasAttention: boolean;
  children: ReactNode;
};

export function ParentAdminPanel({
  summaryText,
  hasAttention,
  children,
}: ParentAdminPanelProps) {
  const [open, setOpen] = useState(hasAttention);

  useEffect(() => {
    const expandFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "pagamenti" || hash === "documenti" || hash === "visita-medica") {
        setOpen(true);
      }
    };

    expandFromHash();
    window.addEventListener("hashchange", expandFromHash);
    return () => window.removeEventListener("hashchange", expandFromHash);
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Area amministrativa
          </p>
          <h3 className="text-sm font-semibold text-zinc-900 sm:text-base">
            Iscrizione, documenti e scadenze
          </h3>
          <p
            className={[
              "mt-1 text-xs font-medium",
              hasAttention ? "text-amber-700" : "text-slate-500",
            ].join(" ")}
          >
            {summaryText}
          </p>
        </div>
        <ChevronDown
          className={[
            "mt-1 h-5 w-5 shrink-0 text-slate-500 transition",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 bg-slate-50/80 px-4 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
