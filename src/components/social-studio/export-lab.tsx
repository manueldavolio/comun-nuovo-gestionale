"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import type { SocialGraphicFormat, SocialGraphicTemplate } from "@prisma/client";
import { GraphicCanvas } from "@/components/social-studio/graphic-canvas";
import type { SocialGraphicOverrides, SocialMatchSnapshot } from "@/lib/social-studio/dto";
import { SOCIAL_FORMAT_SIZE } from "@/lib/social-studio/templates";

type CaseSpec = {
  id: string;
  template: SocialGraphicTemplate;
  format: SocialGraphicFormat;
};

const CASES: CaseSpec[] = (
  [
    ["MATCHDAY", "PORTRAIT_1080x1350"],
    ["MATCHDAY", "SQUARE_1080"],
    ["FULL_TIME", "PORTRAIT_1080x1350"],
    ["FULL_TIME", "SQUARE_1080"],
    ["NEXT_MATCH", "PORTRAIT_1080x1350"],
    ["NEXT_MATCH", "SQUARE_1080"],
  ] as Array<[SocialGraphicTemplate, SocialGraphicFormat]>
).map(([template, format]) => ({
  id: `${template}_${format}`,
  template,
  format,
}));

const SNAPSHOT: SocialMatchSnapshot = {
  eventId: "lab-event",
  startAt: "2026-10-25T15:30:00.000Z",
  endAt: null,
  title: "Comun Nuovo vs Polisportiva Virtus Cologno al Serio",
  type: "LEAGUE_MATCH",
  typeLabel: "Campionato",
  categoryId: "lab-cat",
  categoryName: "Juniores Regionali",
  opponentName: "Polisportiva Virtus Cologno al Serio",
  isHome: true,
  venueSide: "Casa",
  location: "Campo Comunale - Via dello Sport 12",
  homeScore: 2,
  awayScore: 1,
  seasonLabel: "2026/27",
};

function overridesFor(template: SocialGraphicTemplate): SocialGraphicOverrides {
  return {
    headline:
      template === "FULL_TIME" ? "FULL TIME" : template === "NEXT_MATCH" ? "NEXT MATCH" : "MATCHDAY",
    subheadline: "Juniores Regionali",
    kickoffLabel: "sab 25 ott 2026 - 15:30",
    venueSideLabel: "CASA",
    location: "Campo Comunale - Via dello Sport 12",
    clubDisplayName: "Comun Nuovo",
    clubLogoUrl: "/logo-home.png",
    opponentLogoUrl: null,
    homeScore: 2,
    awayScore: 1,
    scorersText: "Rossi 23'\nBianchi 71'\nVerdi 88'",
    styleVariant: "A",
    backgroundColor: "#0b1f63",
    accentColor: "#0369a1",
  };
}

function readPngSizeFromDataUrl(dataUrl: string): { width: number; height: number } {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const view = new DataView(bytes.buffer);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout ${ms}ms: ${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function SocialStudioExportLab() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [caseIndex, setCaseIndex] = useState(0);
  const [status, setStatus] = useState("Pronto");
  const [results, setResults] = useState<
    Array<{
      id: string;
      width: number;
      height: number;
      expectedW: number;
      expectedH: number;
      sizeOk: boolean;
      dataUrl: string;
    }>
  >([]);
  const [mobileWidth, setMobileWidth] = useState<number | null>(null);

  const current = CASES[caseIndex]!;
  const size = SOCIAL_FORMAT_SIZE[current.format];
  const previewScale = useMemo(() => Math.min(1, 360 / size.width), [size.width]);

  async function exportCase(spec: CaseSpec): Promise<{
    id: string;
    width: number;
    height: number;
    expectedW: number;
    expectedH: number;
    sizeOk: boolean;
    dataUrl: string;
  }> {
    const expected = SOCIAL_FORMAT_SIZE[spec.format];
    let node: HTMLDivElement | null = null;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      node =
        document.querySelector<HTMLDivElement>(`[data-export-case="${spec.id}"]`) ??
        canvasRef.current;
      if (node) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!node) throw new Error(`Canvas missing: ${spec.id}`);

    if (typeof document !== "undefined" && "fonts" in document) {
      await document.fonts.ready;
    }
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    node.style.left = "0px";
    node.style.top = "0px";
    node.style.opacity = "1";
    node.style.position = "fixed";
    node.style.zIndex = "9999";

    try {
      const dataUrl = await withTimeout(
        toPng(node, {
          cacheBust: true,
          pixelRatio: 1,
          width: expected.width,
          height: expected.height,
          canvasWidth: expected.width,
          canvasHeight: expected.height,
          skipFonts: false,
          style: {
            transform: "none",
            left: "0",
            top: "0",
            opacity: "1",
            position: "fixed",
          },
        }),
        45_000,
        spec.id,
      );
      const dims = readPngSizeFromDataUrl(dataUrl);
      return {
        id: spec.id,
        width: dims.width,
        height: dims.height,
        expectedW: expected.width,
        expectedH: expected.height,
        sizeOk: dims.width === expected.width && dims.height === expected.height,
        dataUrl,
      };
    } finally {
      node.style.left = "-14000px";
      node.style.zIndex = "0";
    }
  }

  async function exportAll() {
    setStatus("Export in corso…");
    (window as unknown as { __SOCIAL_EXPORT_LAB__?: unknown }).__SOCIAL_EXPORT_LAB__ = {
      status: "running",
      results: [],
    };
    const collected: typeof results = [];
    try {
      for (let i = 0; i < CASES.length; i += 1) {
        const spec = CASES[i]!;
        setCaseIndex(i);
        setStatus(`Preparazione ${spec.id}…`);
        await new Promise((r) => setTimeout(r, 800));
        const one = await exportCase(spec);
        collected.push(one);
        setResults([...collected]);
        setStatus(`Export ${collected.length}/6…`);
      }
      const failed = collected.filter((r) => !r.sizeOk);
      const finalStatus = failed.length ? "fail" : "ok";
      setStatus(
        failed.length
          ? `FAIL dimensioni: ${failed.map((f) => f.id).join(", ")}`
          : `OK ${collected.length}/6 PNG reali via toPng`,
      );
      (window as unknown as { __SOCIAL_EXPORT_LAB__?: unknown }).__SOCIAL_EXPORT_LAB__ = {
        status: finalStatus,
        results: collected,
        exportedAt: new Date().toISOString(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`ERROR: ${message}`);
      (window as unknown as { __SOCIAL_EXPORT_LAB__?: unknown }).__SOCIAL_EXPORT_LAB__ = {
        status: "error",
        error: message,
        results: collected,
      };
    }
  }

  return (
    <main className="min-h-screen bg-white p-4 text-zinc-900">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black">Social Studio Export Lab</h1>
          <p className="text-sm text-zinc-600">
            Export reale con `html-to-image/toPng` (un caso alla volta).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="export-all"
            onClick={() => void exportAll()}
            className="min-h-11 rounded-xl bg-blue-800 px-4 text-sm font-semibold text-white"
          >
            Esporta 6 PNG reali
          </button>
          <button
            type="button"
            data-testid="viewport-375"
            onClick={() => setMobileWidth(375)}
            className="min-h-11 rounded-xl border px-3 text-sm font-semibold"
          >
            375px
          </button>
          <button
            type="button"
            data-testid="viewport-430"
            onClick={() => setMobileWidth(430)}
            className="min-h-11 rounded-xl border px-3 text-sm font-semibold"
          >
            430px
          </button>
        </div>
      </header>

      <p className="mb-3 text-sm font-semibold" data-testid="export-status">
        {status}
        {mobileWidth ? ` · UI max ${mobileWidth}px` : ""}
      </p>

      <div style={mobileWidth ? { maxWidth: mobileWidth } : undefined}>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3" data-case={current.id}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Caso corrente: {current.id}
          </p>
          <GraphicCanvas
            template={current.template}
            format={current.format}
            snapshot={SNAPSHOT}
            overrides={overridesFor(current.template)}
            canvasRef={canvasRef}
            previewScale={previewScale}
            exportCaseId={current.id}
          />
        </div>
      </div>

      {results.length ? (
        <section className="mt-6 space-y-3" data-testid="export-results">
          <h2 className="text-lg font-bold">PNG esportati (reali)</h2>
          {results.map((result) => (
            <div key={result.id} className="rounded-xl border p-3" data-result={result.id}>
              <p className="text-sm font-semibold">
                {result.id}: {result.width}×{result.height}{" "}
                {result.sizeOk ? "OK" : `FAIL (atteso ${result.expectedW}×${result.expectedH})`}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={result.dataUrl}
                alt={result.id}
                className="mt-2 max-h-80 w-auto border"
                data-exported-png={result.id}
              />
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
