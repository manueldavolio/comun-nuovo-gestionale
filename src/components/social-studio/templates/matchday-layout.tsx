import {
  CanvasStage,
  TeamLogo,
  TeamName,
  buildStageBackground,
  resolveSides,
} from "@/components/social-studio/canvas-shared";
import type { GraphicLayoutProps } from "@/components/social-studio/templates/types";
import { SOCIAL_BRAND } from "@/lib/social-studio/templates";

/** MATCHDAY: composizione “derby card” — due colonne stemma+nome, VS centrale, fascia info. */
export function MatchdayLayout({ width, height, view, variant }: GraphicLayoutProps) {
  const portrait = height > width;
  const logoSize = portrait ? 360 : 300;
  const nameSize = portrait ? 48 : 42;
  const sides = resolveSides({
    isHome: view.isHome,
    clubName: view.clubDisplayName || SOCIAL_BRAND.clubName,
    opponentName: view.resolvedOpponent,
    clubLogo: view.clubLogoUrl || SOCIAL_BRAND.clubLogoPath,
    opponentLogo: view.opponentLogoUrl,
    homeScore: view.homeScore,
    awayScore: view.awayScore,
  });
  const bg = buildStageBackground({
    backgroundUrl: view.backgroundUrl,
    backgroundColor: view.backgroundColor,
    accentColor: view.accentColor,
    variant,
  });
  const headline = (view.headline || "MATCHDAY").toUpperCase();
  const category = view.subheadline || view.categoryName;
  const kickoff = view.kickoffLabel || "";
  const location = view.location || view.venueSideLabel || sides.venueBadge;

  if (variant === "B") {
    return (
      <CanvasStage width={width} height={height} background={bg}>
        <div
          style={{
            position: "absolute",
            left: -160,
            top: 0,
            width: 560,
            height: "100%",
            background: "rgba(255,255,255,0.09)",
            transform: "skewX(-14deg)",
          }}
        />
        <div
          style={{
            height: "100%",
            boxSizing: "border-box",
            padding: portrait ? "48px 44px" : "40px 40px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              style={{
                fontFamily: SOCIAL_BRAND.displayFont,
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "0.22em",
                opacity: 0.9,
              }}
            >
              {SOCIAL_BRAND.clubNameFull.toUpperCase()}
            </div>
            <div
              style={{
                fontFamily: SOCIAL_BRAND.displayFont,
                fontSize: 26,
                fontWeight: 800,
                letterSpacing: "0.12em",
                padding: "10px 18px",
                border: "2px solid rgba(255,255,255,0.75)",
                borderRadius: 999,
              }}
            >
              {sides.venueBadge}
            </div>
          </div>

          <div
            style={{
              marginTop: 22,
              fontFamily: SOCIAL_BRAND.displayFont,
              fontSize: portrait ? 96 : 78,
              fontWeight: 800,
              lineHeight: 0.92,
              letterSpacing: "0.04em",
            }}
          >
            {headline}
          </div>
          <div style={{ marginTop: 10, fontSize: 32, fontWeight: 700, color: SOCIAL_BRAND.sky }}>
            {category}
          </div>

          <div
            style={{
              flex: 1,
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: 18,
              marginTop: 28,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <TeamLogo src={sides.left.logo} alt={sides.left.name} fallback={sides.left.name} size={logoSize} tone="solid" />
              <TeamName name={sides.left.name} maxWidth={380} fontSize={nameSize} />
            </div>
            <div
              style={{
                fontFamily: SOCIAL_BRAND.displayFont,
                fontSize: portrait ? 58 : 50,
                fontWeight: 800,
                opacity: 0.95,
              }}
            >
              VS
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
              <TeamLogo src={sides.right.logo} alt={sides.right.name} fallback={sides.right.name} size={logoSize} tone="solid" />
              <TeamName name={sides.right.name} maxWidth={380} fontSize={nameSize} />
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              borderTop: "2px solid rgba(255,255,255,0.28)",
              paddingTop: 22,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontFamily: SOCIAL_BRAND.displayFont, fontSize: 36, fontWeight: 700 }}>{kickoff}</div>
            <div style={{ fontSize: 30, opacity: 0.92 }}>{location}</div>
          </div>
        </div>
      </CanvasStage>
    );
  }

  // Variante A — Arena: badge headline + VS cerchio + fascia info a 2 colonne
  return (
    <CanvasStage width={width} height={height} background={bg}>
      <div
        style={{
          height: "100%",
          boxSizing: "border-box",
          padding: portrait ? "52px 48px" : "40px 40px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div
              style={{
                fontFamily: SOCIAL_BRAND.displayFont,
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "0.24em",
                opacity: 0.85,
              }}
            >
              {SOCIAL_BRAND.clubNameFull.toUpperCase()}
            </div>
            <div
              style={{
                marginTop: 16,
                display: "inline-block",
                fontFamily: SOCIAL_BRAND.displayFont,
                fontSize: portrait ? 82 : 68,
                fontWeight: 800,
                letterSpacing: "0.06em",
                lineHeight: 1,
                padding: "10px 22px",
                background: "rgba(255,255,255,0.12)",
                borderLeft: "8px solid #fff",
              }}
            >
              {headline}
            </div>
            <div style={{ marginTop: 14, fontSize: 32, fontWeight: 700, color: SOCIAL_BRAND.sky }}>
              {category}
            </div>
          </div>
          <div
            style={{
              fontFamily: SOCIAL_BRAND.displayFont,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "0.12em",
              background: "#fff",
              color: SOCIAL_BRAND.primary,
              padding: "12px 18px",
              borderRadius: 12,
            }}
          >
            {sides.venueBadge}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 12,
            marginTop: 20,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <TeamLogo src={sides.left.logo} alt={sides.left.name} fallback={sides.left.name} size={logoSize} tone="solid" />
            <TeamName name={sides.left.name} maxWidth={400} fontSize={nameSize} />
          </div>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.75)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SOCIAL_BRAND.displayFont,
              fontSize: 40,
              fontWeight: 800,
              background: "rgba(0,0,0,0.2)",
            }}
          >
            VS
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <TeamLogo src={sides.right.logo} alt={sides.right.name} fallback={sides.right.name} size={logoSize} tone="solid" />
            <TeamName name={sides.right.name} maxWidth={400} fontSize={nameSize} />
          </div>
        </div>

        <div
          style={{
            marginTop: "auto",
            display: "grid",
            gridTemplateColumns: "1.15fr 1fr",
            gap: 16,
            background: "rgba(0,0,0,0.28)",
            borderRadius: 22,
            padding: "22px 26px",
          }}
        >
          <div>
            <div style={{ fontSize: 20, letterSpacing: "0.16em", opacity: 0.75, fontWeight: 700 }}>
              DATA E ORA
            </div>
            <div style={{ marginTop: 8, fontFamily: SOCIAL_BRAND.displayFont, fontSize: 34, fontWeight: 700 }}>
              {kickoff || "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 20, letterSpacing: "0.16em", opacity: 0.75, fontWeight: 700 }}>
              CAMPO
            </div>
            <div style={{ marginTop: 8, fontFamily: SOCIAL_BRAND.displayFont, fontSize: 32, fontWeight: 700 }}>
              {location}
            </div>
          </div>
        </div>
      </div>
    </CanvasStage>
  );
}
