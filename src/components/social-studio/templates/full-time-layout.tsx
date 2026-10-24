import {
  CanvasStage,
  TeamLogo,
  TeamName,
  buildStageBackground,
  resolveSides,
} from "@/components/social-studio/canvas-shared";
import type { GraphicLayoutProps } from "@/components/social-studio/templates/types";
import { SOCIAL_BRAND } from "@/lib/social-studio/templates";

function scoreLabel(value: number | null | undefined): string {
  return value == null ? "–" : String(value);
}

/**
 * FULL_TIME: composizione “scoreboard” — punteggio dominante al centro,
 * stemmi laterali più contenuti, marcatori multilinea in basso.
 */
export function FullTimeLayout({ width, height, view, variant }: GraphicLayoutProps) {
  const portrait = height > width;
  const logoSize = portrait ? 200 : 170;
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
  const headline = (view.headline || "FULL TIME").toUpperCase();
  const scorers = (view.scorersText || "").trim();
  const category = view.subheadline || view.categoryName;
  const scoreFont = portrait ? 220 : 180;

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
              marginTop: 14,
              fontFamily: SOCIAL_BRAND.displayFont,
              fontSize: 40,
              fontWeight: 800,
              letterSpacing: "0.16em",
              color: SOCIAL_BRAND.sky,
            }}
          >
            {headline}
          </div>
          <div style={{ marginTop: 6, fontSize: 28, fontWeight: 700 }}>{category}</div>

          <div
            style={{
              marginTop: 28,
              flex: 1,
              background: "#fff",
              color: SOCIAL_BRAND.primary,
              borderRadius: 28,
              padding: portrait ? "28px 22px" : "22px 18px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto 1fr",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <TeamLogo src={sides.left.logo} alt={sides.left.name} fallback={sides.left.name} size={logoSize} tone="glass" />
                <TeamName name={sides.left.name} maxWidth={260} fontSize={30} color={SOCIAL_BRAND.primary} />
              </div>
              <div
                style={{
                  fontFamily: SOCIAL_BRAND.displayFont,
                  fontSize: portrait ? 140 : 120,
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  lineHeight: 0.9,
                  textAlign: "center",
                  minWidth: 280,
                }}
              >
                {scoreLabel(sides.left.score)}
                <span style={{ opacity: 0.45, margin: "0 6px" }}>:</span>
                {scoreLabel(sides.right.score)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <TeamLogo src={sides.right.logo} alt={sides.right.name} fallback={sides.right.name} size={logoSize} tone="glass" />
                <TeamName name={sides.right.name} maxWidth={260} fontSize={30} color={SOCIAL_BRAND.primary} />
              </div>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 20, letterSpacing: "0.16em", opacity: 0.75, fontWeight: 700 }}>
              MARCATORI
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 32,
                fontWeight: 600,
                lineHeight: 1.4,
                whiteSpace: "pre-wrap",
                minHeight: 96,
              }}
            >
              {scorers || "—"}
            </div>
          </div>
        </div>
      </CanvasStage>
    );
  }

  // Variante A — Scoreboard open: score enorme a tutta larghezza
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
        }}
      >
        <div
          style={{
            fontFamily: SOCIAL_BRAND.displayFont,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.24em",
            opacity: 0.85,
          }}
        >
          {SOCIAL_BRAND.clubNameFull.toUpperCase()}
        </div>
        <div
          style={{
            marginTop: 14,
            fontFamily: SOCIAL_BRAND.displayFont,
            fontSize: portrait ? 64 : 54,
            fontWeight: 800,
            letterSpacing: "0.12em",
            padding: "8px 24px",
            border: "3px solid rgba(255,255,255,0.75)",
            borderRadius: 14,
          }}
        >
          {headline}
        </div>
        <div style={{ marginTop: 10, fontSize: 28, fontWeight: 700, color: SOCIAL_BRAND.sky }}>
          {category}
        </div>

        <div
          style={{
            marginTop: portrait ? 28 : 20,
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <TeamLogo src={sides.left.logo} alt={sides.left.name} fallback={sides.left.name} size={logoSize} tone="solid" />
            <TeamName name={sides.left.name} maxWidth={280} fontSize={32} />
          </div>

          <div
            style={{
              fontFamily: SOCIAL_BRAND.displayFont,
              fontSize: scoreFont,
              fontWeight: 800,
              letterSpacing: "0.01em",
              lineHeight: 0.88,
              textAlign: "center",
              textShadow: "0 12px 36px rgba(0,0,0,0.4)",
              minWidth: portrait ? 420 : 360,
            }}
          >
            <span>{scoreLabel(sides.left.score)}</span>
            <span style={{ margin: "0 8px", opacity: 0.55, fontSize: scoreFont * 0.7 }}>:</span>
            <span>{scoreLabel(sides.right.score)}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <TeamLogo src={sides.right.logo} alt={sides.right.name} fallback={sides.right.name} size={logoSize} tone="solid" />
            <TeamName name={sides.right.name} maxWidth={280} fontSize={32} />
          </div>
        </div>

        <div
          style={{
            marginTop: "auto",
            width: "100%",
            background: "rgba(0,0,0,0.28)",
            borderRadius: 22,
            padding: "22px 26px",
          }}
        >
          <div style={{ fontSize: 20, letterSpacing: "0.16em", opacity: 0.75, fontWeight: 700 }}>
            MARCATORI
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 34,
              fontWeight: 600,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
              minHeight: 110,
            }}
          >
            {scorers || "—"}
          </div>
        </div>
      </div>
    </CanvasStage>
  );
}
