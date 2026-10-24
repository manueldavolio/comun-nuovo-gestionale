import type { SocialMatchSnapshot, SocialGraphicOverrides } from "@/lib/social-studio/dto";
import type { SocialStyleVariant } from "@/lib/social-studio/style-variants";

export type GraphicView = SocialMatchSnapshot &
  SocialGraphicOverrides & { resolvedOpponent: string };

export type GraphicLayoutProps = {
  width: number;
  height: number;
  view: GraphicView;
  variant: SocialStyleVariant;
};
