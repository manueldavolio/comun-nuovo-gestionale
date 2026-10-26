import type { CSSProperties, ReactNode } from "react";
import { SOCIAL_BRAND } from "@/lib/social-studio/templates";

/**
 * Cornice logo: non deforma stemmi rettangolari/trasparenti (object-fit: contain).
 * Usa riquadro arrotondato (non cerchio stretto) per rispettare proporzioni.
 */
export function TeamLogo({
  src,
  alt,
  fallback,
  size,
  tone = "glass",
}: {
  src: string | null | undefined;
  alt: string;
  fallback: string;
  size: number;
  tone?: "glass" | "solid" | "plain";
}) {
  const radius = Math.round(size * 0.16);
  const pad = Math.round(size * 0.1);
  const bg =
    tone === "solid"
      ? "#ffffff"
      : tone === "plain"
        ? "transparent"
        : "rgba(255,255,255,0.14)";
  const border =
    tone === "plain" ? "none" : "3px solid rgba(255,255,255,0.7)";

  const box: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    background: bg,
    border,
    boxSizing: "border-box",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    padding: pad,
  };

  if (src) {
    return (
      <div style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          crossOrigin="anonymous"
          decoding="sync"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            objectPosition: "center",
            display: "block",
            imageRendering: "auto",
          }}
        />
      </div>
    );
  }

  const initials = fallback
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      style={{
        ...box,
        background:
          tone === "solid"
            ? "linear-gradient(145deg,#ffffff,#e8f1ff)"
            : "linear-gradient(145deg,rgba(255,255,255,0.28),rgba(255,255,255,0.08))",
      }}
    >
      <span
        style={{
          fontFamily: SOCIAL_BRAND.displayFont,
          fontSize: Math.round(size * 0.28),
          fontWeight: 800,
          letterSpacing: "0.06em",
          color: tone === "solid" ? SOCIAL_BRAND.primary : "#fff",
        }}
      >
        {initials || fallback.replace(/\s+/g, "").slice(0, 2).toUpperCase() || "?"}
      </span>
    </div>
  );
}

export function TeamName({
  name,
  maxWidth,
  fontSize = 42,
  color = "#ffffff",
  align = "center",
}: {
  name: string;
  maxWidth: number;
  fontSize?: number;
  color?: string;
  align?: "center" | "left" | "right";
}) {
  return (
    <div
      style={{
        width: maxWidth,
        fontFamily: SOCIAL_BRAND.displayFont,
        fontSize,
        fontWeight: 700,
        lineHeight: 1.08,
        textAlign: align,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        color,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        wordBreak: "break-word",
      }}
    >
      {name}
    </div>
  );
}

export function CanvasStage({
  width,
  height,
  children,
  background,
}: {
  width: number;
  height: number;
  children: ReactNode;
  background: string;
}) {
  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
        color: SOCIAL_BRAND.white,
        fontFamily: SOCIAL_BRAND.bodyFont,
        background,
        boxSizing: "border-box",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 90% 55% at 50% -10%, rgba(125,211,252,0.28), transparent 60%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 70% 40% at 50% 110%, rgba(3,105,161,0.35), transparent 55%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.07,
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.55) 0 1px, transparent 1px 48px)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1, width: "100%", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}

export function buildStageBackground(params: {
  backgroundUrl?: string | null;
  backgroundColor?: string | null;
  accentColor?: string | null;
  variant: "A" | "B";
}): string {
  const primary = params.backgroundColor || SOCIAL_BRAND.primary;
  const accent = params.accentColor || SOCIAL_BRAND.accent;
  if (params.backgroundUrl) {
    return `linear-gradient(180deg, rgba(6,20,63,0.88), rgba(11,31,99,0.82)), url(${params.backgroundUrl}) center/cover`;
  }
  if (params.variant === "B") {
    return `linear-gradient(135deg, ${SOCIAL_BRAND.primaryDeep} 0%, ${primary} 42%, ${accent} 100%)`;
  }
  return `linear-gradient(165deg, ${SOCIAL_BRAND.primaryDeep} 0%, ${primary} 48%, ${accent} 100%)`;
}

export function resolveSides(params: {
  isHome: boolean | null | undefined;
  clubName: string;
  opponentName: string;
  clubLogo: string | null | undefined;
  opponentLogo: string | null | undefined;
  homeScore: number | null | undefined;
  awayScore: number | null | undefined;
}) {
  const cnIsHome = params.isHome !== false;
  if (cnIsHome) {
    return {
      left: {
        name: params.clubName,
        logo: params.clubLogo,
        score: params.homeScore,
        isClub: true,
      },
      right: {
        name: params.opponentName,
        logo: params.opponentLogo,
        score: params.awayScore,
        isClub: false,
      },
      venueBadge: params.isHome === false ? "TRASFERTA" : "CASA",
    };
  }
  return {
    left: {
      name: params.opponentName,
      logo: params.opponentLogo,
      score: params.homeScore,
      isClub: false,
    },
    right: {
      name: params.clubName,
      logo: params.clubLogo,
      score: params.awayScore,
      isClub: true,
    },
    venueBadge: "TRASFERTA",
  };
}
