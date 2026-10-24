import type { SocialGraphicFormat, SocialGraphicTemplate } from "@prisma/client";

export const SOCIAL_GRAPHIC_TEMPLATES: SocialGraphicTemplate[] = [
  "MATCHDAY",
  "FULL_TIME",
  "NEXT_MATCH",
];

export const SOCIAL_GRAPHIC_FORMATS: SocialGraphicFormat[] = [
  "SQUARE_1080",
  "PORTRAIT_1080x1350",
];

export const SOCIAL_TEMPLATE_LABEL: Record<SocialGraphicTemplate, string> = {
  MATCHDAY: "Matchday",
  FULL_TIME: "Full time",
  NEXT_MATCH: "Next match",
};

export const SOCIAL_FORMAT_LABEL: Record<SocialGraphicFormat, string> = {
  SQUARE_1080: "Instagram quadrato 1080×1080",
  PORTRAIT_1080x1350: "Instagram verticale 1080×1350",
};

export const SOCIAL_FORMAT_SIZE: Record<
  SocialGraphicFormat,
  { width: number; height: number }
> = {
  SQUARE_1080: { width: 1080, height: 1080 },
  PORTRAIT_1080x1350: { width: 1080, height: 1350 },
};

export const SOCIAL_DEFAULT_FORMAT: SocialGraphicFormat = "PORTRAIT_1080x1350";

export const SOCIAL_BRAND = {
  primary: "#0b1f63",
  primaryDeep: "#06143f",
  accent: "#0369a1",
  sky: "#e0f2fe",
  white: "#ffffff",
  clubLogoPath: "/logo-home.png",
  clubName: "Comun Nuovo",
  clubNameFull: "Comun Nuovo Calcio",
  displayFont:
    'var(--font-social-display), "Oswald", "Arial Narrow", "Helvetica Neue Condensed", Impact, sans-serif',
  bodyFont:
    'var(--font-social-body), "Montserrat", "Segoe UI", Arial, Helvetica, sans-serif',
} as const;

export function isSocialGraphicTemplate(value: string): value is SocialGraphicTemplate {
  return (SOCIAL_GRAPHIC_TEMPLATES as readonly string[]).includes(value);
}

export function isSocialGraphicFormat(value: string): value is SocialGraphicFormat {
  return (SOCIAL_GRAPHIC_FORMATS as readonly string[]).includes(value);
}

export function defaultHeadline(template: SocialGraphicTemplate): string {
  switch (template) {
    case "MATCHDAY":
      return "MATCHDAY";
    case "FULL_TIME":
      return "FULL TIME";
    case "NEXT_MATCH":
      return "NEXT MATCH";
    default:
      return "PARTITA";
  }
}
