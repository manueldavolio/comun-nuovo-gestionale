"use client";

import type { RefObject } from "react";
import type { SocialGraphicFormat, SocialGraphicTemplate } from "@prisma/client";
import { FullTimeLayout } from "@/components/social-studio/templates/full-time-layout";
import { MatchdayLayout } from "@/components/social-studio/templates/matchday-layout";
import { NextMatchLayout } from "@/components/social-studio/templates/next-match-layout";
import { WeekendLayout } from "@/components/social-studio/templates/weekend-layout";
import type {
  SocialGraphicOverrides,
  SocialGraphicSourceSnapshot,
  SocialMatchSnapshot,
} from "@/lib/social-studio/dto";
import {
  isWeekendSnapshot,
  mergeGraphicView,
  mergeWeekendMatches,
} from "@/lib/social-studio/dto";
import {
  defaultStyleVariant,
  isSocialStyleVariant,
  type SocialStyleVariant,
} from "@/lib/social-studio/style-variants";
import { SOCIAL_BRAND, SOCIAL_FORMAT_SIZE } from "@/lib/social-studio/templates";
import {
  sectorFromTemplate,
  WEEKEND_SECTOR_META,
} from "@/lib/social-studio/weekend-sectors";

type GraphicCanvasProps = {
  template: SocialGraphicTemplate;
  format: SocialGraphicFormat;
  snapshot: SocialGraphicSourceSnapshot;
  overrides: SocialGraphicOverrides;
  canvasRef?: RefObject<HTMLDivElement | null>;
  previewScale?: number;
  /** Attributo data per individuazione nei test export. */
  exportCaseId?: string;
};

function resolveVariant(overrides: SocialGraphicOverrides): SocialStyleVariant {
  const raw = overrides.styleVariant ?? "";
  return isSocialStyleVariant(raw) ? raw : defaultStyleVariant();
}

function TemplateBody({
  template,
  width,
  height,
  snapshot,
  overrides,
  variant,
}: {
  template: SocialGraphicTemplate;
  width: number;
  height: number;
  snapshot: SocialGraphicSourceSnapshot;
  overrides: SocialGraphicOverrides;
  variant: SocialStyleVariant;
}) {
  const sector = sectorFromTemplate(template);
  if (sector && isWeekendSnapshot(snapshot)) {
    const meta = WEEKEND_SECTOR_META[sector];
    const matches = mergeWeekendMatches(snapshot, overrides);
    return (
      <WeekendLayout
        width={width}
        height={height}
        sector={sector}
        snapshot={snapshot}
        matches={matches}
        weekendLabel={(overrides.weekendLabel ?? snapshot.weekendLabel).trim()}
        headline={(overrides.headline ?? "LE NOSTRE PARTITE").trim()}
        footerSlogan={(overrides.footerSlogan ?? meta.footerSlogan.replace("\n", " ")).trim()}
        clubLogoUrl={(overrides.clubLogoUrl ?? SOCIAL_BRAND.clubLogoPath).trim()}
      />
    );
  }

  const view = mergeGraphicView(snapshot as SocialMatchSnapshot, overrides);
  if (template === "FULL_TIME") {
    return <FullTimeLayout width={width} height={height} view={view} variant={variant} />;
  }
  if (template === "NEXT_MATCH") {
    return <NextMatchLayout width={width} height={height} view={view} variant={variant} />;
  }
  return <MatchdayLayout width={width} height={height} view={view} variant={variant} />;
}

/**
 * Anteprima scalata + gemello nativo off-screen per export PNG a dimensioni esatte.
 * Il nodo esportato non ha mai CSS transform.
 */
export function GraphicCanvas({
  template,
  format,
  snapshot,
  overrides,
  canvasRef,
  previewScale = 1,
  exportCaseId,
}: GraphicCanvasProps) {
  const size = SOCIAL_FORMAT_SIZE[format];
  const variant = resolveVariant(overrides);
  const scale = Math.max(0.05, Math.min(previewScale, 1));

  const shared = {
    template,
    width: size.width,
    height: size.height,
    snapshot,
    overrides,
    variant,
  } as const;

  return (
    <>
      <div
        className="mx-auto overflow-hidden rounded-xl shadow-xl ring-1 ring-blue-900/10"
        style={{
          width: size.width * scale,
          height: size.height * scale,
          background: "#0b1f63",
        }}
      >
        <div
          aria-hidden
          style={{
            width: size.width,
            height: size.height,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <TemplateBody {...shared} />
        </div>
      </div>

      <div
        ref={canvasRef}
        data-social-canvas="native"
        data-export-case={exportCaseId || undefined}
        style={{
          position: "fixed",
          left: -14000,
          top: 0,
          width: size.width,
          height: size.height,
          pointerEvents: "none",
          opacity: 1,
        }}
      >
        <TemplateBody {...shared} />
      </div>
    </>
  );
}
