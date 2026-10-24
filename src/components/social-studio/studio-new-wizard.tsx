"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SocialGraphicFormat, SocialGraphicTemplate } from "@prisma/client";
import type { SocialStudioMatchDto } from "@/lib/social-studio/dto";
import {
  SOCIAL_STYLE_VARIANT_LABEL,
  type SocialStyleVariant,
} from "@/lib/social-studio/style-variants";
import {
  SOCIAL_FORMAT_LABEL,
  SOCIAL_GRAPHIC_FORMATS,
  SOCIAL_GRAPHIC_TEMPLATES,
  SOCIAL_TEMPLATE_LABEL,
} from "@/lib/social-studio/templates";

type StudioNewWizardProps = {
  initialMonth: string;
  initialMatches: SocialStudioMatchDto[];
  categories: Array<{ id: string; name: string }>;
};

export function StudioNewWizard({
  initialMonth,
  initialMatches,
  categories,
}: StudioNewWizardProps) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [matches, setMatches] = useState(initialMatches);
  const [categoryId, setCategoryId] = useState("ALL");
  const [eventId, setEventId] = useState("");
  const [template, setTemplate] = useState<SocialGraphicTemplate>("MATCHDAY");
  const [format, setFormat] = useState<SocialGraphicFormat>("PORTRAIT_1080x1350");
  const [styleVariant, setStyleVariant] = useState<SocialStyleVariant>("A");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ month });
        if (categoryId !== "ALL") params.set("categoryId", categoryId);
        const response = await fetch(`/api/social/studio/matches?${params}`);
        const body = (await response.json().catch(() => null)) as {
          data?: { matches?: SocialStudioMatchDto[] };
          error?: string;
        } | null;
        if (!response.ok) throw new Error(body?.error ?? "Caricamento non riuscito.");
        if (!cancelled) {
          setMatches(Array.isArray(body?.data?.matches) ? body!.data!.matches! : []);
          setEventId("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Caricamento non riuscito.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [month, categoryId]);

  async function createDraft() {
    if (!eventId) {
      setError("Seleziona una partita.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/social/studio/graphics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, template, format, styleVariant }),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: { id?: string };
        error?: string;
      } | null;
      if (!response.ok || !body?.data?.id) {
        throw new Error(body?.error ?? "Creazione non riuscita.");
      }
      router.push(`/social/studio/${body.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creazione non riuscita.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-3 sm:p-6">
      <header className="rounded-2xl border border-blue-700 bg-blue-800 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
              Social Studio
            </p>
            <h1 className="mt-1 text-2xl font-black">Nuova grafica</h1>
            <p className="mt-1 text-sm text-sky-100">
              Scegli partita, template e formato. I dati ufficiali restano invariati.
            </p>
          </div>
          <Link
            href="/social/studio"
            className="inline-flex min-h-10 items-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-blue-950"
          >
            Archivio
          </Link>
        </div>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Mese
          <input
            type="month"
            className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>

        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Categoria
          <select
            className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="ALL">Tutte</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Partita
          <select
            className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            disabled={loading}
          >
            <option value="">Seleziona…</option>
            {matches.map((match) => {
              const when = new Date(match.startAt).toLocaleString("it-IT", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "UTC",
              });
              const opponent = match.opponentName || match.title;
              return (
                <option key={match.eventId} value={match.eventId}>
                  {when} · {match.categoryName} vs {opponent}
                </option>
              );
            })}
          </select>
        </label>

        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Template
          <select
            className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            value={template}
            onChange={(e) => setTemplate(e.target.value as SocialGraphicTemplate)}
          >
            {SOCIAL_GRAPHIC_TEMPLATES.map((value) => (
              <option key={value} value={value}>
                {SOCIAL_TEMPLATE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Variante estetica
          <select
            className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            value={styleVariant}
            onChange={(e) => setStyleVariant(e.target.value as SocialStyleVariant)}
          >
            {(["A", "B"] as const).map((value) => (
              <option key={value} value={value}>
                {SOCIAL_STYLE_VARIANT_LABEL[template][value]}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          Formato
          <select
            className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
            value={format}
            onChange={(e) => setFormat(e.target.value as SocialGraphicFormat)}
          >
            {SOCIAL_GRAPHIC_FORMATS.map((value) => (
              <option key={value} value={value}>
                {SOCIAL_FORMAT_LABEL[value]}
              </option>
            ))}
          </select>
        </label>

        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}

        <button
          type="button"
          disabled={loading || !eventId}
          onClick={() => void createDraft()}
          className="mt-2 min-h-11 rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
        >
          {loading ? "Attendere…" : "Crea bozza"}
        </button>
      </section>
    </div>
  );
}
