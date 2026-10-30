"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ESORDIENTI_TUTTOCAMPO_WIDGET,
  ESORDIENTI_TUTTOCAMPO_WIDGET_UUID,
  TUTTOCAMPO_CATEGORY_UUID_SLOTS,
  buildTuttocampoWidgetUrls,
  findVerifiedCompetitionHint,
  isEsordientiCategory,
  isValidTuttocampoWidgetUuid,
  seasonLabelToWidgetParam,
  sourceTypeLabel,
} from "@/lib/team-competition";

type CategoryOption = { id: string; name: string; seasonLabel: string; sector: string | null };

type Initial = {
  categoryId: string;
  seasonLabel: string;
  competitionName: string;
  groupLabel: string;
  sourceType: "NONE" | "TUTTOCAMPO" | "CRL_LND" | "MANUAL";
  sourcePageUrl: string;
  tuttocampoWidgetUuid: string;
  widgetSeasonParam: string;
  widgetStandingsUrl: string;
  widgetResultsUrl: string;
  widgetScorersUrl: string;
  widgetLastMatchUrl: string;
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
  const [allowSharedUuid, setAllowSharedUuid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedCategory = categories.find((c) => c.id === formData.categoryId);
  const isEsordientiUuid =
    formData.tuttocampoWidgetUuid.trim().toLowerCase() ===
    ESORDIENTI_TUTTOCAMPO_WIDGET_UUID.toLowerCase();
  const esordientiUuidOnWrongCategory =
    isEsordientiUuid && selectedCategory && !isEsordientiCategory(selectedCategory.name);

  const previewUrls = useMemo(() => {
    if (!isValidTuttocampoWidgetUuid(formData.tuttocampoWidgetUuid)) return null;
    try {
      return buildTuttocampoWidgetUrls(
        formData.tuttocampoWidgetUuid,
        formData.widgetSeasonParam || null,
      );
    } catch {
      return null;
    }
  }, [formData.tuttocampoWidgetUuid, formData.widgetSeasonParam]);

  function applyHint() {
    const cat = categories.find((c) => c.id === formData.categoryId);
    if (!cat) return;
    const hint = findVerifiedCompetitionHint(cat.name);
    if (!hint) {
      setError("Nessun hint verificato per questa categoria: compilare a mano.");
      return;
    }
    const esordienti = isEsordientiCategory(cat.name);
    setFormData((p) => ({
      ...p,
      seasonLabel: cat.seasonLabel || p.seasonLabel,
      competitionName: hint.competitionName,
      groupLabel: hint.groupLabel ?? "",
      sourceType: hint.sourceType,
      sourcePageUrl: hint.sourcePageUrl ?? "",
      sourceNotes: hint.sourceNotes,
      lastVerifiedAt: hint.verifiedAt,
      widgetSeasonParam:
        seasonLabelToWidgetParam(cat.seasonLabel) ?? p.widgetSeasonParam ?? "2026-27",
      tuttocampoWidgetUuid: esordienti
        ? ESORDIENTI_TUTTOCAMPO_WIDGET_UUID
        : p.tuttocampoWidgetUuid,
    }));
    setError(null);
  }

  function generateFromUuid() {
    if (!isValidTuttocampoWidgetUuid(formData.tuttocampoWidgetUuid)) {
      setError("Inserisci un UUID Tuttocampo valido prima di generare gli URL.");
      return;
    }
    const urls = buildTuttocampoWidgetUrls(
      formData.tuttocampoWidgetUuid,
      formData.widgetSeasonParam || null,
    );
    setFormData((p) => ({
      ...p,
      sourceType: "TUTTOCAMPO",
      widgetResultsUrl: urls.results,
      widgetStandingsUrl: urls.standings,
      widgetScorersUrl: urls.scorers,
      widgetLastMatchUrl: urls.lastMatch,
      widgetNextMatchUrl: urls.nextMatch,
    }));
    setError(null);
    setOk("Cinque URL WidgetV2 generati dall’UUID (non ancora salvati).");
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
          tuttocampoWidgetUuid: formData.tuttocampoWidgetUuid || null,
          widgetSeasonParam: formData.widgetSeasonParam || null,
          widgetStandingsUrl: formData.widgetStandingsUrl || null,
          widgetResultsUrl: formData.widgetResultsUrl || null,
          widgetScorersUrl: formData.widgetScorersUrl || null,
          widgetLastMatchUrl: formData.widgetLastMatchUrl || null,
          widgetNextMatchUrl: formData.widgetNextMatchUrl || null,
          manualStandingsJson: formData.manualStandingsJson || null,
          sourceNotes: formData.sourceNotes || null,
          lastVerifiedAt: formData.lastVerifiedAt || null,
          allowSharedUuid,
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
        Compila da hint verificati 2026/27 (senza UUID)
      </button>

      <section className="rounded-xl border border-sky-200 bg-sky-50/80 p-3 text-xs text-sky-950">
        <p className="font-bold">UUID per categoria (configurabili dall’admin)</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {TUTTOCAMPO_CATEGORY_UUID_SLOTS.map((slot) => (
            <li key={slot.key}>
              {slot.label}:{" "}
              {slot.uuidKnown ? (
                <span className="font-mono">{slot.uuidKnown}</span>
              ) : (
                <span className="italic">da inserire</span>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2">{ESORDIENTI_TUTTOCAMPO_WIDGET.note}</p>
        <button
          type="button"
          className="mt-2 rounded-lg border border-sky-400 bg-white px-2 py-1 font-bold text-sky-950"
          onClick={() => {
            const esordienti =
              categories.find((c) => isEsordientiCategory(c.name)) ?? null;
            setFormData((p) => ({
              ...p,
              categoryId: esordienti?.id ?? p.categoryId,
              seasonLabel: esordienti?.seasonLabel ?? p.seasonLabel,
              competitionName: "Esordienti",
              tuttocampoWidgetUuid: ESORDIENTI_TUTTOCAMPO_WIDGET_UUID,
              widgetSeasonParam: ESORDIENTI_TUTTOCAMPO_WIDGET.widgetSeasonParam,
              sourceType: "TUTTOCAMPO",
              sourceNotes: ESORDIENTI_TUTTOCAMPO_WIDGET.note,
            }));
            setAllowSharedUuid(false);
            setOk(null);
            setError(
              esordienti
                ? null
                : "Categoria Esordienti non trovata tra le attive: selezionala manualmente.",
            );
          }}
        >
          Collega UUID Esordienti
        </button>
      </section>

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
          Stagione gestionale
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
        UUID Tuttocampo WidgetV2
        <input
          className={`${input} font-mono`}
          value={formData.tuttocampoWidgetUuid}
          onChange={(e) => {
            setFormData((p) => ({ ...p, tuttocampoWidgetUuid: e.target.value.trim() }));
            setAllowSharedUuid(false);
          }}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        />
      </label>
      <label className="block text-sm font-semibold text-blue-950">
        Stagione widget (?y=)
        <input
          className={input}
          value={formData.widgetSeasonParam}
          onChange={(e) => setFormData((p) => ({ ...p, widgetSeasonParam: e.target.value.trim() }))}
          placeholder="2026-27"
        />
        <span className="mt-1 block text-xs font-normal text-zinc-500">
          Formato AAAA-AA. Lascia vuoto per il default Tuttocampo.
        </span>
      </label>
      <button
        type="button"
        onClick={generateFromUuid}
        className="rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-bold text-white"
      >
        Genera i 5 URL ufficiali dall’UUID
      </button>

      {esordientiUuidOnWrongCategory || allowSharedUuid ? (
        <label className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <input
            type="checkbox"
            className="mt-1"
            checked={allowSharedUuid}
            onChange={(e) => setAllowSharedUuid(e.target.checked)}
          />
          <span>
            {esordientiUuidOnWrongCategory
              ? "Sto riusando l’UUID Esordienti su un’altra categoria (scelta amministrativa esplicita)."
              : "Consenti di riusare un UUID già collegato a un’altra categoria (sconsigliato)."}
          </span>
        </label>
      ) : (
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            className="mt-1"
            checked={allowSharedUuid}
            onChange={(e) => setAllowSharedUuid(e.target.checked)}
          />
          <span>Consenti UUID condiviso tra categorie (solo se necessario)</span>
        </label>
      )}

      {previewUrls ? (
        <ul className="space-y-1 rounded-lg border border-sky-100 bg-sky-50/50 p-3 font-mono text-[11px] text-zinc-700">
          <li>Risultati: {previewUrls.results}</li>
          <li>Classifica: {previewUrls.standings}</li>
          <li>Marcatori: {previewUrls.scorers}</li>
          <li>Ultima: {previewUrls.lastMatch}</li>
          <li>Prossima: {previewUrls.nextMatch}</li>
        </ul>
      ) : null}

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
        Solo URL ufficiali{" "}
        <code className="rounded bg-zinc-100 px-1">https://www.tuttocampo.it/WidgetV2/…</code>. Non
        incollare HTML iframe arbitrario.
      </p>
      <details className="rounded-lg border border-zinc-200 p-2 text-sm">
        <summary className="cursor-pointer font-semibold text-blue-950">
          URL generati (sola lettura operativa)
        </summary>
        <div className="mt-2 space-y-2">
          {(
            [
              ["widgetResultsUrl", "Risultati"],
              ["widgetStandingsUrl", "Classifica"],
              ["widgetScorersUrl", "Marcatori"],
              ["widgetLastMatchUrl", "Ultima partita"],
              ["widgetNextMatchUrl", "Prossima partita"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-xs font-semibold text-zinc-700">
              {label}
              <input
                className={`${input} font-mono text-[11px]`}
                value={formData[key]}
                readOnly
              />
            </label>
          ))}
        </div>
      </details>
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
