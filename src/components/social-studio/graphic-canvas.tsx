"use client";

import type { RefObject } from "react";
import type { SocialGraphicFormat, SocialGraphicTemplate } from "@prisma/client";
import { FullTimeLayout } from "@/components/social-studio/templates/full-time-layout";
import { MatchdayLayout } from "@/components/social-studio/templates/matchday-layout";
import { NextMatchLayout } from "@/components/social-studio/templates/next-match-layout";
import type {
  SocialGraphicOverrides,
  SocialMatchSnapshot,
} from "@/lib/social-studio/dto";
import { mergeGraphicView } from "@/lib/social-studio/dto";
import {
  defaultStyleVariant,
  isSocialStyleVariant,
  type SocialStyleVariant,
} from "@/lib/social-studio/style-variants";
import { SOCIAL_FORMAT_SIZE } from "@/lib/social-studio/templates";

type GraphicCanvasProps = {
  template: SocialGraphicTemplate;
  format: SocialGraphicFormat;
  snapshot: SocialMatchSnapshot;
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
  view,
  variant,
}: {
  template: SocialGraphicTemplate;
  width: number;
  height: number;
  view: ReturnType<typeof mergeGraphicView>;
  variant: SocialStyleVariant;
}) {
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
  const view = mergeGraphicView(snapshot, overrides);
  const variant = resolveVariant(overrides);
  const scale = Math.max(0.05, Math.min(previewScale, 1));

  const shared = {
    template,
    width: size.width,
    height: size.height,
    view,
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
