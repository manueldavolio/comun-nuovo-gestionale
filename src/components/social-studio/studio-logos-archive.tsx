"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { SocialAssetDto } from "@/lib/social-studio/dto";
import { matchOpponentAsset, normalizeOpponentKey } from "@/lib/social-studio/opponent-key";

const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";
const MAX_BYTES = 8 * 1024 * 1024;

type StudioLogosArchiveProps = {
  initialAssets: SocialAssetDto[];
  userName: string;
};

type PendingReplace = {
  file: File;
  existing: SocialAssetDto;
  label: string;
};

export function StudioLogosArchive({
  initialAssets,
  userName,
}: StudioLogosArchiveProps) {
  const [assets, setAssets] = useState(
    initialAssets.filter((a) => a.kind === "OPPONENT_LOGO"),
  );
  const [q, setQ] = useState("");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aliasSourceId, setAliasSourceId] = useState("");
  const [aliasLabel, setAliasLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingReplace, setPendingReplace] = useState<PendingReplace | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return assets;
    return assets.filter(
      (asset) =>
        asset.label.toLowerCase().includes(needle) ||
        (asset.normalizedKey ?? "").includes(needle),
    );
  }, [assets, q]);

  const aliasSuggestion = useMemo(() => {
    if (!aliasLabel.trim()) return null;
    const match = matchOpponentAsset(aliasLabel, assets);
    return match.kind === "none" ? null : match;
  }, [aliasLabel, assets]);

  function upsertAsset(asset: SocialAssetDto) {
    setAssets((prev) => {
      const without = prev.filter((a) => a.id !== asset.id);
      return [...without, asset].sort((a, b) => a.label.localeCompare(b.label, "it"));
    });
  }

  function onPickFile(next: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(next ? URL.createObjectURL(next) : null);
    if (next && !label.trim()) {
      setLabel(next.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
    }
  }

  function validateFile(candidate: File): string | null {
    if (!ACCEPT.split(",").includes(candidate.type) && candidate.type !== "image/jpg") {
      return "Formato non supportato. Usa PNG, JPG, WEBP o SVG.";
    }
    if (candidate.size <= 0) return "File vuoto.";
    if (candidate.size > MAX_BYTES) return "Dimensione massima 8 MB.";
    return null;
  }

  async function postUpload(uploadFile: File, uploadLabel: string, replace = false) {
    setError(null);
    setMessage(null);
    const invalid = validateFile(uploadFile);
    if (invalid) {
      setError(invalid);
      return;
    }
    const form = new FormData();
    form.set("kind", "OPPONENT_LOGO");
    form.set("label", uploadLabel.trim());
    form.set("file", uploadFile);
    if (replace) form.set("replace", "true");

    const response = await fetch("/api/social/studio/assets", {
      method: "POST",
      body: form,
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      code?: string;
      data?: SocialAssetDto;
      existing?: SocialAssetDto;
      replaced?: boolean;
    } | null;

    if (response.status === 409 && body?.code === "ASSET_EXISTS" && body.existing) {
      setPendingReplace({ file: uploadFile, existing: body.existing, label: uploadLabel });
      setMessage(
        `Esiste già uno stemma per “${body.existing.label}”. Conferma per sostituirlo (le locandine già salvate restano invariate).`,
      );
      return;
    }

    if (!response.ok || !body?.data) {
      setError(body?.error ?? "Caricamento non riuscito.");
      return;
    }

    upsertAsset(body.data);
    setPendingReplace(null);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setLabel("");
    setMessage(
      body.replaced
        ? "Stemma aggiornato in archivio. Le nuove locandine useranno il file nuovo."
        : "Stemma salvato in Archivio Loghi Squadre.",
    );
    startTransition(() => undefined);
  }

  async function confirmAlias() {
    setError(null);
    setMessage(null);
    if (!aliasSourceId || !aliasLabel.trim()) {
      setError("Seleziona uno stemma e indica il nome calendario da collegare.");
      return;
    }
    const response = await fetch("/api/social/studio/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "alias",
        sourceAssetId: aliasSourceId,
        aliasLabel: aliasLabel.trim(),
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      data?: SocialAssetDto;
    } | null;
    if (!response.ok || !body?.data) {
      setError(body?.error ?? "Alias non creato.");
      return;
    }
    upsertAsset(body.data);
    setMessage(
      `Alias verificato: “${body.data.label}” → chiave ${body.data.normalizedKey ?? normalizeOpponentKey(body.data.label)}.`,
    );
    setAliasLabel("");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-6">
      <header className="rounded-2xl border border-blue-700 bg-blue-800 p-5 text-white shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
              Social Studio
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-tight">
              Archivio Loghi Squadre
            </h1>
            <p className="mt-1 text-sm text-sky-100">
              Stemmi avversari riusabili · {userName}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/social/studio"
              className="inline-flex min-h-10 items-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-blue-950"
            >
              Bozze
            </Link>
            <Link
              href="/social/studio/nuovo"
              className="inline-flex min-h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-blue-900"
            >
              Nuova grafica
            </Link>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-blue-900">
          Carica stemma società
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Associa il logo alla società avversaria (non alla singola partita). Formati: PNG,
          JPG, WEBP, SVG sicuri · max 8 MB.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-dashed border-blue-200 bg-sky-50">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Anteprima"
                className="max-h-full max-w-full object-contain p-3"
              />
            ) : (
              <span className="px-3 text-center text-xs font-semibold uppercase tracking-wide text-blue-700/70">
                Anteprima
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              Nome società
              <input
                className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Es. Oratorio Arcene Brignano"
              />
            </label>
            {label.trim() ? (
              <p className="text-xs text-zinc-500">
                Chiave normalizzata:{" "}
                <span className="font-mono text-blue-800">
                  {normalizeOpponentKey(label) || "—"}
                </span>
              </p>
            ) : null}
            <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
              File
              <input
                type="file"
                accept={ACCEPT}
                className="mt-1 block w-full text-sm"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              type="button"
              disabled={isPending || !file || !label.trim()}
              onClick={() => {
                if (file) void postUpload(file, label, false);
              }}
              className="min-h-11 rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
            >
              Salva in archivio
            </button>
          </div>
        </div>

        {pendingReplace ? (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-semibold">Sostituire lo stemma esistente?</p>
            <p className="mt-1 text-amber-900/90">{pendingReplace.existing.label}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="min-h-10 flex-1 rounded-lg bg-amber-700 px-3 text-sm font-semibold text-white"
                onClick={() =>
                  void postUpload(pendingReplace.file, pendingReplace.label, true)
                }
              >
                Sì, sostituisci
              </button>
              <button
                type="button"
                className="min-h-10 flex-1 rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold"
                onClick={() => setPendingReplace(null)}
              >
                Annulla
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-blue-900">
          Alias verificato
        </h2>
        <p className="mt-1 text-sm text-zinc-600">
          Collega un nome del calendario (es. “Or. Arcene Brignano”) a uno stemma già
          caricato. I nomi ambigui non vengono associati automaticamente.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Stemma esistente
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={aliasSourceId}
              onChange={(e) => setAliasSourceId(e.target.value)}
            >
              <option value="">Seleziona…</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Nome da collegare (come in calendario)
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={aliasLabel}
              onChange={(e) => setAliasLabel(e.target.value)}
              placeholder="Es. Or. Arcene Brignano"
            />
          </label>
        </div>
        {aliasSuggestion?.kind === "exact" ? (
          <p className="mt-2 text-sm font-semibold text-emerald-700">
            Esiste già un match esatto: {aliasSuggestion.asset.label}
          </p>
        ) : null}
        {aliasSuggestion?.kind === "fuzzy" ? (
          <p className="mt-2 text-sm font-semibold text-amber-800">
            Suggerimento simile (non applicato): {aliasSuggestion.asset.label}. Conferma
            esplicitamente l’alias se corretto.
          </p>
        ) : null}
        <button
          type="button"
          disabled={isPending || !aliasSourceId || !aliasLabel.trim()}
          onClick={() => void confirmAlias()}
          className="mt-3 min-h-11 rounded-xl border border-blue-200 bg-sky-50 px-4 text-sm font-semibold text-blue-900 disabled:opacity-60"
        >
          Conferma alias
        </button>
      </section>

      <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-blue-900">
            Stemmi in archivio ({filtered.length})
          </h2>
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Cerca
            <input
              className="mt-1 min-h-10 w-full min-w-[220px] rounded-xl border border-zinc-200 px-3 text-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome o chiave…"
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-blue-200 bg-sky-50/60 p-6 text-center text-sm text-zinc-600">
            Nessuno stemma. Carica il primo logo società qui sopra.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {filtered.map((asset) => (
              <li
                key={asset.id}
                className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-white to-sky-50/40 p-3"
              >
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.publicUrl}
                    alt=""
                    className="max-h-full max-w-full object-contain p-1"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-blue-950">{asset.label}</p>
                  <p className="truncate font-mono text-[11px] text-zinc-500">
                    {asset.normalizedKey ?? "—"}
                  </p>
                  <label className="mt-2 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    Sostituisci file
                    <input
                      type="file"
                      accept={ACCEPT}
                      className="mt-1 block w-full text-xs"
                      onChange={(e) => {
                        const next = e.target.files?.[0];
                        if (next) void postUpload(next, asset.label, true);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
    </div>
  );
}
