"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Shield } from "lucide-react";

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
    <section className="overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-sky-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={[
              "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
              hasAttention ? "bg-sky-100 text-blue-800" : "bg-blue-50 text-blue-700",
            ].join(" ")}
          >
            <Shield className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-800">
              Documenti e scadenze
            </p>
            <h3 className="text-base font-bold text-zinc-900">
              Certificato, quote e pratiche
            </h3>
            <p
              className={[
                "mt-1 text-sm font-medium",
                hasAttention ? "text-sky-800" : "text-zinc-500",
              ].join(" ")}
            >
              {summaryText}
            </p>
          </div>
        </div>
        <ChevronDown
          className={[
            "mt-1 h-5 w-5 shrink-0 text-blue-700 transition",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-sky-100 bg-gradient-to-b from-sky-50/80 to-white px-4 py-4">
          {children}
        </div>
      ) : null}
    </section>
  );
}
