"use client";

import type { RefObject } from "react";
import type { SocialGraphicFormat, SocialGraphicTemplate } from "@prisma/client";
import type { SocialGraphicOverrides, SocialMatchSnapshot } from "@/lib/social-studio/dto";
import { mergeGraphicView } from "@/lib/social-studio/dto";
import { SOCIAL_BRAND, SOCIAL_FORMAT_SIZE } from "@/lib/social-studio/templates";

type GraphicCanvasProps = {
  template: SocialGraphicTemplate;
  format: SocialGraphicFormat;
  snapshot: SocialMatchSnapshot;
  overrides: SocialGraphicOverrides;
  canvasRef?: RefObject<HTMLDivElement | null>;
  scale?: number;
};

function Logo({ src, alt, fallback }: { src: string | null | undefined; alt: string; fallback: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className="h-full w-full object-contain" />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-white/15 text-2xl font-black text-white">
      {fallback.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function GraphicCanvas({
  template,
  format,
  snapshot,
  overrides,
  canvasRef,
  scale = 1,
}: GraphicCanvasProps) {
  const size = SOCIAL_FORMAT_SIZE[format];
  const view = mergeGraphicView(snapshot, overrides);
  const bg = view.backgroundColor || SOCIAL_BRAND.primary;
  const accent = view.accentColor || SOCIAL_BRAND.accent;
  const headline = (view.headline || template.replaceAll("_", " ")).toUpperCase();
  const sub = view.subheadline || view.categoryName;
  const kickoff = view.kickoffLabel || "";
  const venue = view.venueSideLabel || view.venueSide;
  const location = view.location || "";
  const clubLogo = view.clubLogoUrl || SOCIAL_BRAND.clubLogoPath;
  const showScore = template === "FULL_TIME";
  const cnScore = view.isHome === false ? view.awayScore : view.homeScore;
  const oppScore = view.isHome === false ? view.homeScore : view.awayScore;

  return (
    <div
      className="mx-auto overflow-hidden rounded-lg shadow-lg"
      style={{
        width: size.width * scale,
        height: size.height * scale,
      }}
    >
      <div
        ref={canvasRef}
        style={{
          width: size.width,
          height: size.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: view.backgroundUrl
            ? `linear-gradient(180deg, rgba(11,31,99,0.82), rgba(3,105,161,0.88)), url(${view.backgroundUrl}) center/cover`
            : `linear-gradient(165deg, ${bg} 0%, ${accent} 100%)`,
          color: "#fff",
          fontFamily: "Arial, Helvetica, sans-serif",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          boxSizing: "border-box",
        }}
      >
        <div style={{ letterSpacing: "0.22em", fontSize: 28, fontWeight: 700, opacity: 0.9 }}>
          {SOCIAL_BRAND.clubName.toUpperCase()}
        </div>
        <div style={{ marginTop: 28, fontSize: 72, fontWeight: 900, lineHeight: 1 }}>{headline}</div>
        <div style={{ marginTop: 16, fontSize: 36, fontWeight: 700, color: "#e0f2fe" }}>{sub}</div>

        <div
          style={{
            marginTop: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 32,
            flex: 1,
          }}
        >
          <div style={{ width: 220, height: 220 }}>
            <Logo src={clubLogo} alt="Comun Nuovo" fallback="CN" />
          </div>

          <div style={{ textAlign: "center", flex: 1 }}>
            {showScore ? (
              <div style={{ fontSize: 96, fontWeight: 900, letterSpacing: "0.06em" }}>
                {cnScore ?? "–"} : {oppScore ?? "–"}
              </div>
            ) : (
              <div style={{ fontSize: 42, fontWeight: 800, opacity: 0.95 }}>VS</div>
            )}
            <div style={{ marginTop: 20, fontSize: 44, fontWeight: 800, lineHeight: 1.15 }}>
              {view.resolvedOpponent}
            </div>
            <div style={{ marginTop: 16, fontSize: 28, fontWeight: 600, color: "#bae6fd" }}>
              {venue}
            </div>
          </div>

          <div style={{ width: 220, height: 220 }}>
            <Logo
              src={view.opponentLogoUrl}
              alt={view.resolvedOpponent}
              fallback={view.resolvedOpponent}
            />
          </div>
        </div>

        <div style={{ marginTop: "auto", borderTop: "2px solid rgba(255,255,255,0.25)", paddingTop: 28 }}>
          <div style={{ fontSize: 32, fontWeight: 700 }}>{kickoff}</div>
          {location ? (
            <div style={{ marginTop: 10, fontSize: 28, opacity: 0.9 }}>{location}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
