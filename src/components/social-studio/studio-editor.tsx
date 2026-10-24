"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toPng } from "html-to-image";
import type { SocialGraphicFormat, SocialGraphicStatus } from "@prisma/client";
import { GraphicCanvas } from "@/components/social-studio/graphic-canvas";
import type {
  SocialAssetDto,
  SocialGraphicDetail,
  SocialGraphicOverrides,
} from "@/lib/social-studio/dto";
import { matchOpponentAsset } from "@/lib/social-studio/opponent-key";
import {
  SOCIAL_STYLE_VARIANT_LABEL,
  isSocialStyleVariant,
  type SocialStyleVariant,
} from "@/lib/social-studio/style-variants";
import {
  SOCIAL_BRAND,
  SOCIAL_FORMAT_LABEL,
  SOCIAL_FORMAT_SIZE,
  SOCIAL_TEMPLATE_LABEL,
  isSocialGraphicFormat,
} from "@/lib/social-studio/templates";

type StudioEditorProps = {
  initialGraphic: SocialGraphicDetail;
  assets: SocialAssetDto[];
};

export function StudioEditor({ initialGraphic, assets: initialAssets }: StudioEditorProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewHostRef = useRef<HTMLDivElement>(null);
  const [graphic, setGraphic] = useState(initialGraphic);
  const [overrides, setOverrides] = useState<SocialGraphicOverrides>(initialGraphic.overrides);
  const [assets, setAssets] = useState(initialAssets);
  const [title, setTitle] = useState(initialGraphic.title);
  const [format, setFormat] = useState<SocialGraphicFormat>(initialGraphic.format);
  const [status, setStatus] = useState<SocialGraphicStatus>(initialGraphic.status);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [previewScale, setPreviewScale] = useState(0.55);
  const [pendingReplace, setPendingReplace] = useState<{
    file: File;
    existing: SocialAssetDto;
    label: string;
  } | null>(null);

  const size = SOCIAL_FORMAT_SIZE[format];
  const styleVariant: SocialStyleVariant = isSocialStyleVariant(overrides.styleVariant ?? "")
    ? (overrides.styleVariant as SocialStyleVariant)
    : "A";

  const opponentLogos = useMemo(
    () => assets.filter((a) => a.kind === "OPPONENT_LOGO"),
    [assets],
  );
  const backgrounds = useMemo(
    () => assets.filter((a) => a.kind === "BACKGROUND"),
    [assets],
  );

  const opponentName =
    overrides.opponentName ?? graphic.sourceSnapshot.opponentName ?? "";

  const autoLogoMatch = useMemo(() => {
    if (overrides.opponentLogoUrl) return null;
    const match = matchOpponentAsset(opponentName, opponentLogos);
    return match.kind === "exact" || match.kind === "fuzzy" ? match : null;
  }, [opponentName, opponentLogos, overrides.opponentLogoUrl]);

  const effectiveOverrides = useMemo<SocialGraphicOverrides>(() => {
    if (!autoLogoMatch) return overrides;
    return { ...overrides, opponentLogoUrl: autoLogoMatch.asset.publicUrl };
  }, [overrides, autoLogoMatch]);

  useEffect(() => {
    function updateScale() {
      const host = previewHostRef.current;
      if (!host) return;
      const available = Math.max(280, host.clientWidth - 8);
      setPreviewScale(Math.min(1, available / size.width));
    }
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [size.width]);

  function patchOverride<K extends keyof SocialGraphicOverrides>(
    key: K,
    value: SocialGraphicOverrides[K],
  ) {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/social/studio/graphics/${graphic.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updatedAt: graphic.updatedAt,
        title,
        format,
        status,
        overrides: effectiveOverrides,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      data?: SocialGraphicDetail;
    } | null;
    if (response.status === 409 && body?.data) {
      setGraphic(body.data);
      setOverrides(body.data.overrides);
      setTitle(body.data.title);
      setFormat(body.data.format);
      setStatus(body.data.status);
      setError(body.error ?? "Conflitto di salvataggio.");
      return;
    }
    if (!response.ok || !body?.data) {
      setError(body?.error ?? "Salvataggio non riuscito.");
      return;
    }
    setGraphic(body.data);
    setOverrides(body.data.overrides);
    setMessage("Bozza salvata.");
    startTransition(() => router.refresh());
  }

  async function downloadPng() {
    if (!canvasRef.current) return;
    setError(null);
    try {
      // Attendi font/immagini
      if (typeof document !== "undefined" && "fonts" in document) {
        await document.fonts.ready;
      }
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const dataUrl = await toPng(canvasRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: size.width,
        height: size.height,
        canvasWidth: size.width,
        canvasHeight: size.height,
        style: {
          transform: "none",
          left: "0",
          opacity: "1",
        },
      });
      const link = document.createElement("a");
      link.download = `${graphic.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "grafica"}.png`;
      link.href = dataUrl;
      link.click();
      setMessage("PNG scaricato (dimensioni native). Il calendario non è stato modificato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export PNG non riuscito.");
    }
  }

  async function postAsset(file: File, label: string, replace = false) {
    const form = new FormData();
    form.set("kind", "OPPONENT_LOGO");
    form.set("label", label);
    form.set("file", file);
    if (replace) form.set("replace", "true");
    const response = await fetch("/api/social/studio/assets", { method: "POST", body: form });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      code?: string;
      data?: SocialAssetDto;
      existing?: SocialAssetDto;
    } | null;

    if (response.status === 409 && body?.code === "ASSET_EXISTS" && body.existing) {
      setPendingReplace({ file, existing: body.existing, label });
      setError(null);
      setMessage(
        `Esiste già uno stemma per “${body.existing.label}”. Conferma per sostituirlo.`,
      );
      return;
    }

    if (!response.ok || !body?.data) {
      setError(body?.error ?? "Upload non riuscito.");
      return;
    }

    setAssets((prev) => {
      const without = prev.filter((a) => a.id !== body.data!.id);
      return [...without, body.data!].sort((a, b) => a.label.localeCompare(b.label, "it"));
    });
    patchOverride("opponentLogoUrl", body.data.publicUrl);
    setPendingReplace(null);
    setMessage(replace ? "Stemma aggiornato e applicato." : "Stemma salvato in archivio e applicato.");
    startTransition(() => router.refresh());
  }

  async function uploadOpponentLogo(file: File) {
    const label =
      (overrides.opponentName ?? graphic.sourceSnapshot.opponentName ?? "").trim() ||
      file.name.replace(/\.[^.]+$/, "") ||
      "Avversario";
    await postAsset(file, label, false);
  }

  async function uploadGeneric(
    kind: "BACKGROUND" | "CLUB_LOGO",
    file: File,
  ) {
    const form = new FormData();
    form.set("kind", kind);
    form.set("label", file.name.replace(/\.[^.]+$/, "") || kind);
    form.set("file", file);
    const response = await fetch("/api/social/studio/assets", { method: "POST", body: form });
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      data?: SocialAssetDto;
    } | null;
    if (!response.ok || !body?.data) {
      setError(body?.error ?? "Upload non riuscito.");
      return;
    }
    setAssets((prev) => [...prev, body.data!]);
    if (kind === "CLUB_LOGO") patchOverride("clubLogoUrl", body.data.publicUrl);
    if (kind === "BACKGROUND") patchOverride("backgroundUrl", body.data.publicUrl);
    setMessage("Asset caricato e applicato alla bozza.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 p-2 pb-28 sm:gap-4 sm:p-6 sm:pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-blue-700 bg-blue-800 p-3 text-white sm:p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
            Social Studio
          </p>
          <h1 className="mt-1 text-xl font-black sm:text-2xl">
            {SOCIAL_TEMPLATE_LABEL[graphic.template]}
          </h1>
          <p className="mt-1 text-sm text-sky-100">
            Bozza indipendente · calendario ufficiale invariato
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/social/studio"
            className="inline-flex min-h-10 items-center rounded-xl border border-sky-200 bg-sky-50 px-3 text-sm font-semibold text-blue-950"
          >
            Archivio
          </Link>
          <Link
            href="/social/calendario"
            className="inline-flex min-h-10 items-center rounded-xl border border-white/30 px-3 text-sm font-semibold text-white"
          >
            Calendario
          </Link>
        </div>
      </header>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] xl:gap-4">
        <section
          ref={previewHostRef}
          className="order-1 overflow-x-auto rounded-2xl border border-blue-100 bg-zinc-100 p-2 sm:p-5"
        >
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 sm:mb-3 sm:text-xs">
            Anteprima · {size.width}×{size.height}px · {Math.round(previewScale * 100)}%
          </p>
          <GraphicCanvas
            template={graphic.template}
            format={format}
            snapshot={graphic.sourceSnapshot}
            overrides={effectiveOverrides}
            canvasRef={canvasRef}
            previewScale={previewScale}
          />
        </section>

        <section className="order-2 flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white p-3 shadow-sm sm:p-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Titolo archivio
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Formato
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={format}
              onChange={(e) => {
                if (isSocialGraphicFormat(e.target.value)) setFormat(e.target.value);
              }}
            >
              {Object.entries(SOCIAL_FORMAT_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Variante estetica
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={styleVariant}
              onChange={(e) => patchOverride("styleVariant", e.target.value)}
            >
              {(["A", "B"] as const).map((value) => (
                <option key={value} value={value}>
                  {SOCIAL_STYLE_VARIANT_LABEL[graphic.template][value]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Headline
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.headline ?? ""}
              onChange={(e) => patchOverride("headline", e.target.value)}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Categoria
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.subheadline ?? ""}
              onChange={(e) => patchOverride("subheadline", e.target.value)}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Nome casa (grafica)
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.clubDisplayName ?? SOCIAL_BRAND.clubName}
              onChange={(e) => patchOverride("clubDisplayName", e.target.value)}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Avversario (solo grafica)
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={opponentName}
              onChange={(e) => patchOverride("opponentName", e.target.value)}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Data / ora
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.kickoffLabel ?? ""}
              onChange={(e) => patchOverride("kickoffLabel", e.target.value)}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Campo / luogo
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.location ?? graphic.sourceSnapshot.location ?? ""}
              onChange={(e) => patchOverride("location", e.target.value)}
            />
          </label>

          {graphic.template === "FULL_TIME" ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Gol casa
                  <input
                    type="number"
                    className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
                    value={overrides.homeScore ?? graphic.sourceSnapshot.homeScore ?? ""}
                    onChange={(e) =>
                      patchOverride(
                        "homeScore",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </label>
                <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Gol trasferta
                  <input
                    type="number"
                    className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
                    value={overrides.awayScore ?? graphic.sourceSnapshot.awayScore ?? ""}
                    onChange={(e) =>
                      patchOverride(
                        "awayScore",
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                  />
                </label>
              </div>
              <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Marcatori
                <textarea
                  className="mt-1 min-h-24 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                  value={overrides.scorersText ?? ""}
                  onChange={(e) => patchOverride("scorersText", e.target.value)}
                  placeholder={"Rossi 12'\nBianchi 67'"}
                />
              </label>
            </>
          ) : null}

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Stemma avversario (archivio)
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.opponentLogoUrl ?? ""}
              onChange={(e) => patchOverride("opponentLogoUrl", e.target.value || null)}
            >
              <option value="">Monogramma</option>
              {opponentLogos.map((asset) => (
                <option key={asset.id} value={asset.publicUrl}>
                  {asset.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Carica / aggiorna stemma avversario
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="mt-1 block w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadOpponentLogo(file);
                e.target.value = "";
              }}
            />
          </label>

          {pendingReplace ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-semibold">Sostituire lo stemma esistente?</p>
              <p className="mt-1 text-amber-900/90">{pendingReplace.existing.label}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="min-h-10 flex-1 rounded-lg bg-amber-700 px-3 text-sm font-semibold text-white"
                  onClick={() =>
                    void postAsset(pendingReplace.file, pendingReplace.label, true)
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

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Sfondo immagine (opzionale)
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.backgroundUrl ?? ""}
              onChange={(e) => patchOverride("backgroundUrl", e.target.value || null)}
            >
              <option value="">Atmosfera brand (senza foto)</option>
              {backgrounds.map((asset) => (
                <option key={asset.id} value={asset.publicUrl}>
                  {asset.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Carica sfondo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-1 block w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadGeneric("BACKGROUND", file);
              }}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Stato
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as SocialGraphicStatus)}
            >
              <option value="DRAFT">Bozza</option>
              <option value="EXPORTED">Esportata</option>
              <option value="ARCHIVED">Archiviata</option>
            </select>
          </label>

          {autoLogoMatch?.kind === "fuzzy" ? (
            <p className="text-sm font-semibold text-amber-800">
              Stemma suggerito per nome simile: {autoLogoMatch.asset.label}
            </p>
          ) : null}
          {autoLogoMatch?.kind === "exact" && !overrides.opponentLogoUrl ? (
            <p className="text-sm font-semibold text-emerald-700">
              Stemma archivio applicato automaticamente.
            </p>
          ) : null}
          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}

          <div className="mt-1 hidden flex-col gap-2 sm:flex">
            <button
              type="button"
              disabled={isPending}
              onClick={() => void save()}
              className="min-h-11 rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
            >
              Salva bozza
            </button>
            <button
              type="button"
              onClick={() => void downloadPng()}
              className="min-h-11 rounded-xl border border-blue-200 bg-sky-50 px-4 text-sm font-semibold text-blue-900"
            >
              Scarica PNG
            </button>
          </div>
        </section>
      </div>

      {/* Azioni fisse su smartphone */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-blue-100 bg-white/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-7xl gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => void save()}
            className="min-h-12 flex-1 rounded-xl bg-blue-800 px-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            Salva
          </button>
          <button
            type="button"
            onClick={() => void downloadPng()}
            className="min-h-12 flex-1 rounded-xl border border-blue-200 bg-sky-50 px-3 text-sm font-semibold text-blue-900"
          >
            PNG
          </button>
        </div>
      </div>
    </div>
  );
}
