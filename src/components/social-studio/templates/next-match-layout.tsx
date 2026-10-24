import {
  CanvasStage,
  TeamLogo,
  buildStageBackground,
} from "@/components/social-studio/canvas-shared";
import type { GraphicLayoutProps } from "@/components/social-studio/templates/types";
import { SOCIAL_BRAND } from "@/lib/social-studio/templates";

/**
 * NEXT_MATCH: composizione “poster avversario” — stemma avversario hero,
 * nome grande, meta in blocchi (non la griglia bilanciata del Matchday).
 */
export function NextMatchLayout({ width, height, view, variant }: GraphicLayoutProps) {
  const portrait = height > width;
  const clubLogo = view.clubLogoUrl || SOCIAL_BRAND.clubLogoPath;
  const clubName = view.clubDisplayName || SOCIAL_BRAND.clubName;
  const opponent = view.resolvedOpponent;
  const category = view.subheadline || view.categoryName;
  const kickoff = view.kickoffLabel || "";
  const location = view.location || view.venueSideLabel || "";
  const venue =
    view.venueSideLabel ||
    (view.isHome === false ? "TRASFERTA" : view.isHome === true ? "CASA" : "SEDE");
  const bg = buildStageBackground({
    backgroundUrl: view.backgroundUrl,
    backgroundColor: view.backgroundColor,
    accentColor: view.accentColor,
    variant,
  });
  const headline = (view.headline || "NEXT MATCH").toUpperCase();
  const heroLogo = portrait ? 380 : 300;

  if (variant === "B") {
    return (
      <CanvasStage width={width} height={height} background={bg}>
        <div
          style={{
            height: "100%",
            boxSizing: "border-box",
            padding: portrait ? "44px 40px" : "36px 36px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <TeamLogo src={clubLogo} alt={clubName} fallback={clubName} size={88} tone="solid" />
            <div
              style={{
                fontFamily: SOCIAL_BRAND.displayFont,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "0.12em",
                background: "#fff",
                color: SOCIAL_BRAND.primary,
                padding: "12px 18px",
                borderRadius: 12,
              }}
            >
              {venue}
            </div>
          </div>

          <div
            style={{
              marginTop: 22,
              fontFamily: SOCIAL_BRAND.displayFont,
              fontSize: portrait ? 62 : 52,
              fontWeight: 800,
              letterSpacing: "0.08em",
            }}
          >
            {headline}
          </div>
          <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: SOCIAL_BRAND.sky }}>
            {category}
          </div>

          <div style={{ marginTop: 28, display: "grid", gap: 16, flex: 1, alignContent: "start" }}>
            {[
              { label: "AVVERSARIO", value: opponent },
              { label: "DATA E ORA", value: kickoff || "—" },
              { label: "LUOGO", value: location || "—" },
            ].map((block) => (
              <div
                key={block.label}
                style={{
                  background: "rgba(255,255,255,0.12)",
                  borderRadius: 18,
                  padding: "20px 24px",
                  borderLeft: "8px solid #fff",
                }}
              >
                <div style={{ fontSize: 20, letterSpacing: "0.18em", opacity: 0.8, fontWeight: 700 }}>
                  {block.label}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    fontFamily: SOCIAL_BRAND.displayFont,
                    fontSize: portrait ? 44 : 38,
                    fontWeight: 800,
                    lineHeight: 1.12,
                    textTransform: "uppercase",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {block.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CanvasStage>
    );
  }

  // Variante A — Focus: stemma avversario enorme al centro
  return (
    <CanvasStage width={width} height={height} background={bg}>
      <div
        style={{
          height: "100%",
          boxSizing: "border-box",
          padding: portrait ? "44px 40px" : "36px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <TeamLogo src={clubLogo} alt={clubName} fallback={clubName} size={72} tone="solid" />
          <div
            style={{
              fontFamily: SOCIAL_BRAND.displayFont,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.2em",
              opacity: 0.9,
            }}
          >
            {SOCIAL_BRAND.clubNameFull.toUpperCase()}
          </div>
          <div
            style={{
              fontFamily: SOCIAL_BRAND.displayFont,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "0.1em",
              background: "#fff",
              color: SOCIAL_BRAND.primary,
              padding: "10px 14px",
              borderRadius: 10,
            }}
          >
            {venue}
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            fontFamily: SOCIAL_BRAND.displayFont,
            fontSize: portrait ? 68 : 56,
            fontWeight: 800,
            letterSpacing: "0.1em",
          }}
        >
          {headline}
        </div>
        <div style={{ marginTop: 8, fontSize: 28, fontWeight: 700, color: SOCIAL_BRAND.sky }}>
          {category}
        </div>

        <div style={{ marginTop: portrait ? 28 : 18 }}>
          <TeamLogo
            src={view.opponentLogoUrl}
            alt={opponent}
            fallback={opponent}
            size={heroLogo}
            tone="solid"
          />
        </div>

        <div
          style={{
            marginTop: 20,
            fontFamily: SOCIAL_BRAND.displayFont,
            fontSize: portrait ? 58 : 48,
            fontWeight: 800,
            lineHeight: 1.05,
            textTransform: "uppercase",
            maxWidth: 960,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {opponent}
        </div>

        <div
          style={{
            marginTop: "auto",
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          <div
            style={{
              background: "rgba(0,0,0,0.28)",
              borderRadius: 18,
              padding: "18px 20px",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 18, letterSpacing: "0.16em", opacity: 0.75, fontWeight: 700 }}>
              QUANDO
            </div>
            <div style={{ marginTop: 8, fontFamily: SOCIAL_BRAND.displayFont, fontSize: 30, fontWeight: 700 }}>
              {kickoff || "—"}
            </div>
          </div>
          <div
            style={{
              background: "rgba(0,0,0,0.28)",
              borderRadius: 18,
              padding: "18px 20px",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 18, letterSpacing: "0.16em", opacity: 0.75, fontWeight: 700 }}>
              DOVE
            </div>
            <div style={{ marginTop: 8, fontFamily: SOCIAL_BRAND.displayFont, fontSize: 30, fontWeight: 700 }}>
              {location || "—"}
            </div>
          </div>
        </div>
      </div>
    </CanvasStage>
  );
}
