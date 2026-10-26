import type { SocialGraphicTemplate } from "@prisma/client";

export const SOCIAL_STYLE_VARIANTS = ["A", "B"] as const;
export type SocialStyleVariant = (typeof SOCIAL_STYLE_VARIANTS)[number];

export const SOCIAL_STYLE_VARIANT_LABEL: Record<
  SocialGraphicTemplate,
  Record<SocialStyleVariant, string>
> = {
  MATCHDAY: {
    A: "Arena — fari e VS centrale",
    B: "Stripe — diagonale club",
  },
  FULL_TIME: {
    A: "Scoreboard — risultato gigante",
    B: "Banner — fascia risultato",
  },
  NEXT_MATCH: {
    A: "Focus — avversario in evidenza",
    B: "Countdown — data e luogo",
  },
  WEEKEND_BASE: {
    A: "Locandina ufficiale Attività di Base",
    B: "Locandina ufficiale Attività di Base",
  },
  WEEKEND_AGONISTICO: {
    A: "Locandina ufficiale Settore Agonistico",
    B: "Locandina ufficiale Settore Agonistico",
  },
};

export function isSocialStyleVariant(value: string): value is SocialStyleVariant {
  return (SOCIAL_STYLE_VARIANTS as readonly string[]).includes(value);
}

export function defaultStyleVariant(): SocialStyleVariant {
  return "A";
}
