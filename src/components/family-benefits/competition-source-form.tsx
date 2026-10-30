"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { findVerifiedCompetitionHint, sourceTypeLabel } from "@/lib/team-competition";

type CategoryOption = { id: string; name: string; seasonLabel: string; sector: string | null };

type Initial = {
  categoryId: string;
  seasonLabel: string;
  competitionName: string;
  groupLabel: string;
  sourceType: "NONE" | "TUTTOCAMPO" | "CRL_LND" | "MANUAL";
  sourcePageUrl: string;
  widgetStandingsUrl: string;
  widgetResultsUrl: string;
  widgetNextMatchUrl: string;
  manualStandingsJson: string;
  sourceNotes: string;
  lastVerifiedAt: string;
  isActive: boolean;
};

type Props = {
  categories: CategoryOption[];
  initialValues: Initial;
};

export function CompetitionSourceForm({ categories, initialValues }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function applyHint() {
    const cat = categories.find((c) => c.id === formData.categoryId);
    if (!cat) return;
    const hint = findVerifiedCompetitionHint(cat.name);
    if (!hint) {
      setError("Nessun hint verificato per questa categoria: compilare a mano.");
      return;
    }
    setFormData((p) => ({
      ...p,
      seasonLabel: cat.seasonLabel || p.seasonLabel,
      competitionName: hint.competitionName,
      groupLabel: hint.groupLabel,
      sourceType: hint.sourceType,
      sourcePageUrl: hint.sourcePageUrl ?? "",
      sourceNotes: hint.sourceNotes,
      lastVerifiedAt: hint.verifiedAt,
    }));
    setError(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const response = await fetch("/api/admin/competition-sources", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          groupLabel: formData.groupLabel || null,
          sourcePageUrl: formData.sourcePageUrl || null,
          widgetStandingsUrl: formData.widgetStandingsUrl || null,
          widgetResultsUrl: formData.widgetResultsUrl || null,
          widgetNextMatchUrl: formData.widgetNextMatchUrl || null,
          manualStandingsJson: formData.manualStandingsJson || null,
          sourceNotes: formData.sourceNotes || null,
          lastVerifiedAt: formData.lastVerifiedAt || null,
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setError(body?.error ?? "Salvataggio non riuscito.");
        return;
      }
      setOk("Fonte salvata.");
      router.refresh();
    } catch {
      setError("Errore imprevisto.");
    } finally {
      setSaving(false);
    }
  }

  const input =
    "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2";

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      <label className="block text-sm font-semibold text-blue-950">
        Categoria gestionale
        <select
          className={input}
          value={formData.categoryId}
          onChange={(e) => setFormData((p) => ({ ...p, categoryId: e.target.value }))}
          required
        >
          <option value="">Seleziona…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.seasonLabel}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={applyHint}
        className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-blue-900"
      >
        Compila da hint verificati 2026/27
      </button>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-blue-950">
          Campionato
          <input
            className={input}
            value={formData.competitionName}
            onChange={(e) => setFormData((p) => ({ ...p, competitionName: e.target.value }))}
            required
          />
        </label>
        <label className="text-sm font-semibold text-blue-950">
          Girone
          <input
            className={input}
            value={formData.groupLabel}
            onChange={(e) => setFormData((p) => ({ ...p, groupLabel: e.target.value }))}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-semibold text-blue-950">
          Stagione
          <input
            className={input}
            value={formData.seasonLabel}
            onChange={(e) => setFormData((p) => ({ ...p, seasonLabel: e.target.value }))}
            required
          />
        </label>
        <label className="text-sm font-semibold text-blue-950">
          Tipo fonte
          <select
            className={input}
            value={formData.sourceType}
            onChange={(e) =>
              setFormData((p) => ({
                ...p,
                sourceType: e.target.value as Initial["sourceType"],
              }))
            }
          >
            {(["NONE", "TUTTOCAMPO", "CRL_LND", "MANUAL"] as const).map((t) => (
              <option key={t} value={t}>
                {sourceTypeLabel(t)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-blue-950">
          Verificata il
          <input
            type="date"
            className={input}
            value={formData.lastVerifiedAt}
            onChange={(e) => setFormData((p) => ({ ...p, lastVerifiedAt: e.target.value }))}
          />
        </label>
      </div>
      <label className="block text-sm font-semibold text-blue-950">
        URL pagina fonte (https)
        <input
          className={input}
          value={formData.sourcePageUrl}
          onChange={(e) => setFormData((p) => ({ ...p, sourcePageUrl: e.target.value }))}
          placeholder="https://www.tuttocampo.it/…"
        />
      </label>
      <p className="text-xs text-zinc-600">
        Widget: genera gli iframe da{" "}
        <a
          href="https://www.tuttocampo.it/WidgetApi"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-blue-800 underline"
        >
          Tuttocampo WidgetApi
        </a>{" "}
        (login richiesto). Non inventare UUID.
      </p>
      <label className="block text-sm font-semibold text-blue-950">
        Widget classifica (iframe src)
        <input
          className={input}
          value={formData.widgetStandingsUrl}
          onChange={(e) => setFormData((p) => ({ ...p, widgetStandingsUrl: e.target.value }))}
          placeholder="https://www.tuttocampo.it/WidgetV2/Classifica/…"
        />
      </label>
      <label className="block text-sm font-semibold text-blue-950">
        Widget risultati (iframe src)
        <input
          className={input}
          value={formData.widgetResultsUrl}
          onChange={(e) => setFormData((p) => ({ ...p, widgetResultsUrl: e.target.value }))}
        />
      </label>
      <label className="block text-sm font-semibold text-blue-950">
        Widget prossima partita (iframe src)
        <input
          className={input}
          value={formData.widgetNextMatchUrl}
          onChange={(e) => setFormData((p) => ({ ...p, widgetNextMatchUrl: e.target.value }))}
        />
      </label>
      <label className="block text-sm font-semibold text-blue-950">
        Classifica manuale JSON (fallback)
        <textarea
          className={`${input} font-mono text-xs`}
          rows={4}
          value={formData.manualStandingsJson}
          onChange={(e) => setFormData((p) => ({ ...p, manualStandingsJson: e.target.value }))}
          placeholder='[{"pos":1,"team":"…","points":12}]'
        />
      </label>
      <label className="block text-sm font-semibold text-blue-950">
        Note / citazione fonte
        <textarea
          className={input}
          rows={3}
          value={formData.sourceNotes}
          onChange={(e) => setFormData((p) => ({ ...p, sourceNotes: e.target.value }))}
        />
      </label>
      <label className="inline-flex items-center gap-2 text-sm font-semibold text-blue-950">
        <input
          type="checkbox"
          checked={formData.isActive}
          onChange={(e) => setFormData((p) => ({ ...p, isActive: e.target.checked }))}
        />
        Attiva
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-700">{ok}</p> : null}
      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      >
        {saving ? "Salvataggio..." : "Salva fonte"}
      </button>
    </form>
  );
}
