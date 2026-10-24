"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toPng } from "html-to-image";
import type { SocialGraphicFormat, SocialGraphicStatus } from "@prisma/client";
import { GraphicCanvas } from "@/components/social-studio/graphic-canvas";
import type {
  SocialAssetDto,
  SocialGraphicDetail,
  SocialGraphicOverrides,
} from "@/lib/social-studio/dto";
import {
  SOCIAL_FORMAT_LABEL,
  SOCIAL_FORMAT_SIZE,
  SOCIAL_TEMPLATE_LABEL,
  isSocialGraphicFormat,
} from "@/lib/social-studio/templates";

type StudioEditorProps = {
  initialGraphic: SocialGraphicDetail;
  assets: SocialAssetDto[];
};

export function StudioEditor({ initialGraphic, assets }: StudioEditorProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [graphic, setGraphic] = useState(initialGraphic);
  const [overrides, setOverrides] = useState<SocialGraphicOverrides>(initialGraphic.overrides);
  const [title, setTitle] = useState(initialGraphic.title);
  const [format, setFormat] = useState<SocialGraphicFormat>(initialGraphic.format);
  const [status, setStatus] = useState<SocialGraphicStatus>(initialGraphic.status);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const size = SOCIAL_FORMAT_SIZE[format];
  const previewScale = Math.min(1, 360 / size.width);

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
        overrides,
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
      const dataUrl = await toPng(canvasRef.current, {
        cacheBust: true,
        pixelRatio: 1,
        width: size.width,
        height: size.height,
      });
      const link = document.createElement("a");
      link.download = `${graphic.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "grafica"}.png`;
      link.href = dataUrl;
      link.click();
      setMessage("PNG scaricato in locale. Il calendario ufficiale non è stato modificato.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export PNG non riuscito.");
    }
  }

  async function uploadAsset(kind: "OPPONENT_LOGO" | "BACKGROUND" | "CLUB_LOGO", file: File) {
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
    if (kind === "OPPONENT_LOGO") patchOverride("opponentLogoUrl", body.data.publicUrl);
    if (kind === "CLUB_LOGO") patchOverride("clubLogoUrl", body.data.publicUrl);
    if (kind === "BACKGROUND") patchOverride("backgroundUrl", body.data.publicUrl);
    setMessage("Asset caricato e applicato alla bozza.");
    startTransition(() => router.refresh());
  }

  const opponentLogos = assets.filter((a) => a.kind === "OPPONENT_LOGO");
  const backgrounds = assets.filter((a) => a.kind === "BACKGROUND");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-3 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-blue-700 bg-blue-800 p-4 text-white">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
            Social Studio
          </p>
          <h1 className="mt-1 text-xl font-black sm:text-2xl">
            {SOCIAL_TEMPLATE_LABEL[graphic.template]}
          </h1>
          <p className="mt-1 text-sm text-sky-100">
            Modifiche solo sulla bozza · nessun aggiornamento al calendario
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <section className="overflow-x-auto rounded-2xl border border-blue-100 bg-zinc-100 p-3 sm:p-4">
          <GraphicCanvas
            template={graphic.template}
            format={format}
            snapshot={graphic.sourceSnapshot}
            overrides={overrides}
            canvasRef={canvasRef}
            scale={previewScale}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
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
            Headline
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.headline ?? ""}
              onChange={(e) => patchOverride("headline", e.target.value)}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Sottotitolo / categoria
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.subheadline ?? ""}
              onChange={(e) => patchOverride("subheadline", e.target.value)}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Avversario (solo grafica)
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.opponentName ?? graphic.sourceSnapshot.opponentName ?? ""}
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
            Campo
            <input
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.location ?? graphic.sourceSnapshot.location ?? ""}
              onChange={(e) => patchOverride("location", e.target.value)}
            />
          </label>

          {graphic.template === "FULL_TIME" ? (
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
          ) : null}

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Colore sfondo
            <input
              type="color"
              className="mt-1 h-11 w-full rounded-xl border border-zinc-200"
              value={overrides.backgroundColor || "#0b1f63"}
              onChange={(e) => patchOverride("backgroundColor", e.target.value)}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Logo avversario (libreria)
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
            Carica logo avversario
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="mt-1 block w-full text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadAsset("OPPONENT_LOGO", file);
              }}
            />
          </label>

          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Sfondo immagine
            <select
              className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 px-3 text-sm"
              value={overrides.backgroundUrl ?? ""}
              onChange={(e) => patchOverride("backgroundUrl", e.target.value || null)}
            >
              <option value="">Gradiente brand</option>
              {backgrounds.map((asset) => (
                <option key={asset.id} value={asset.publicUrl}>
                  {asset.label}
                </option>
              ))}
            </select>
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

          {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
          {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}

          <div className="mt-1 flex flex-col gap-2">
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
    </div>
  );
}
