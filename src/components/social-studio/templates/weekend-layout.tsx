"use client";

import type { CSSProperties } from "react";
import type { SocialWeekendMatchRow, SocialWeekendSnapshot } from "@/lib/social-studio/dto";
import { SOCIAL_BRAND } from "@/lib/social-studio/templates";
import { WEEKEND_SECTOR_META, type WeekendSector } from "@/lib/social-studio/weekend-sectors";

export type WeekendLayoutProps = {
  width: number;
  height: number;
  sector: WeekendSector;
  snapshot: SocialWeekendSnapshot;
  matches: SocialWeekendMatchRow[];
  weekendLabel: string;
  headline: string;
  footerSlogan: string;
  clubLogoUrl: string;
};

function OpponentMark({
  name,
  logoUrl,
  size,
}: {
  name: string;
  logoUrl?: string | null;
  size: number;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        crossOrigin="anonymous"
        decoding="sync"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          borderRadius: size * 0.18,
          background: "rgba(255,255,255,0.92)",
          flexShrink: 0,
          imageRendering: "auto",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.18,
        background: "linear-gradient(145deg,#e8f7ff,#ffffff)",
        border: "1px solid rgba(11,31,99,0.18)",
        display: "grid",
        placeItems: "center",
        color: SOCIAL_BRAND.primary,
        fontWeight: 800,
        fontSize: size * 0.32,
        flexShrink: 0,
        fontFamily: SOCIAL_BRAND.bodyFont,
      }}
    >
      {initials || "?"}
    </div>
  );
}

function BrushBanner({
  text,
  width,
  accent,
}: {
  text: string;
  width: number;
  accent: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        padding: `${width * 0.012}px ${width * 0.04}px`,
        background: `linear-gradient(110deg, ${accent} 0%, #4fd0ff 55%, ${accent} 100%)`,
        color: "#fff",
        fontFamily: SOCIAL_BRAND.displayFont,
        fontWeight: 700,
        fontSize: width * 0.038,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        transform: "skewX(-8deg)",
        boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
        clipPath: "polygon(2% 8%, 98% 0%, 100% 92%, 0% 100%)",
      }}
    >
      <span style={{ transform: "skewX(8deg)", whiteSpace: "nowrap" }}>{text}</span>
    </div>
  );
}

function SideBadge({
  label,
  fontSize,
}: {
  label: string;
  fontSize: number;
}) {
  if (!label) return null;
  const isAway = label === "TRASFERTA";
  const isHome = label === "CASA";
  return (
    <span
      style={{
        display: "inline-block",
        marginTop: 3,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize,
        fontWeight: 800,
        letterSpacing: "0.06em",
        color: isAway ? "#9a3412" : isHome ? "#0369a1" : "#334155",
        background: isAway
          ? "rgba(251,146,60,0.22)"
          : isHome
            ? "rgba(14,165,233,0.18)"
            : "rgba(148,163,184,0.2)",
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

function MatchRow({
  row,
  width,
  index,
  sector,
  rowHeight,
  compact,
}: {
  row: SocialWeekendMatchRow;
  width: number;
  index: number;
  sector: WeekendSector;
  rowHeight: number;
  compact: boolean;
}) {
  const opponent =
    (row.opponentName ?? "").trim() || row.title.replace(/^.*?\bvs\b/i, "").trim() || "Avversario";
  const venue = (row.venueLabel ?? "").trim();
  const side = (row.venueSideLabel ?? "").trim();
  const alt = index % 2 === 1;
  const catBg =
    sector === "AGONISTICO"
      ? SOCIAL_BRAND.primaryDeep
      : index % 3 === 0
        ? "#4ec9ff"
        : index % 3 === 1
          ? "#1aa8ef"
          : SOCIAL_BRAND.primary;

  const catFs = compact ? Math.max(11, width * 0.014) : Math.max(14, width * 0.017);
  const mainFs = compact ? Math.max(12, width * 0.015) : Math.max(15, width * 0.019);
  const metaFs = compact ? Math.max(10, width * 0.012) : Math.max(12, width * 0.014);
  const logoSize = compact ? Math.max(28, width * 0.036) : Math.max(40, width * 0.048);
  const padY = compact ? rowHeight * 0.08 : rowHeight * 0.1;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact
          ? `${width * 0.15}px ${width * 0.2}px minmax(0, 1.35fr) minmax(0, 1fr)`
          : `${width * 0.16}px ${width * 0.2}px minmax(0, 1.4fr) minmax(0, 1fr)`,
        alignItems: "center",
        columnGap: width * 0.012,
        rowGap: 0,
        height: rowHeight,
        boxSizing: "border-box",
        padding: `${padY}px ${width * 0.014}px`,
        background: alt ? "rgba(224,242,254,0.72)" : "rgba(255,255,255,0.96)",
        borderBottom: "1px solid rgba(11,31,99,0.08)",
        fontFamily: SOCIAL_BRAND.bodyFont,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: catBg,
          color: "#fff",
          borderRadius: 10,
          padding: `${Math.max(4, padY * 0.4)}px ${width * 0.01}px`,
          fontWeight: 800,
          fontSize: catFs,
          textAlign: "center",
          lineHeight: 1.15,
          letterSpacing: "0.02em",
          alignSelf: "center",
        }}
      >
        {row.displayCategory}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: mainFs, color: SOCIAL_BRAND.primaryDeep, lineHeight: 1.15 }}>
          {row.dayLabel}
        </div>
        <div
          style={{
            marginTop: 2,
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontWeight: 700,
            fontSize: metaFs,
            color: SOCIAL_BRAND.primary,
          }}
        >
          <span aria-hidden>⏱</span>
          {row.timeLabel}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: width * 0.01,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontWeight: 900,
            fontSize: metaFs,
            color: SOCIAL_BRAND.accent,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          VS
        </span>
        <OpponentMark name={opponent} logoUrl={row.opponentLogoUrl} size={logoSize} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: mainFs,
              color: "#0a1a3a",
              lineHeight: 1.2,
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              display: "-webkit-box",
              WebkitLineClamp: compact ? 2 : 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {opponent}
          </div>
          <SideBadge label={side} fontSize={Math.max(9, metaFs * 0.9)} />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 4,
          minWidth: 0,
          color: "#334155",
          fontSize: metaFs,
          fontWeight: 600,
          lineHeight: 1.25,
          alignSelf: "center",
        }}
      >
        {venue ? (
          <>
            <span aria-hidden style={{ flexShrink: 0 }}>
              📍
            </span>
            <span
              style={{
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                display: "-webkit-box",
                WebkitLineClamp: compact ? 3 : 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {venue}
            </span>
          </>
        ) : (
          <span style={{ opacity: 0.45 }}>—</span>
        )}
      </div>
    </div>
  );
}

function resolveLayoutMetrics(matchCount: number, height: number) {
  const sparse = matchCount > 0 && matchCount <= 2;
  const dense = matchCount >= 8;
  const headerH = sparse ? height * 0.3 : dense ? height * 0.3 : height * 0.33;
  const footerH = sparse ? height * 0.2 : dense ? height * 0.15 : height * 0.17;
  const listTop = sparse ? headerH + height * 0.02 : headerH;
  const listBottom = height - footerH;
  const listMaxH = Math.max(180, listBottom - listTop - height * 0.015);
  const compact = matchCount >= 6;
  const ideal =
    matchCount <= 0
      ? 110
      : matchCount === 1
        ? Math.min(160, listMaxH * 0.55)
        : matchCount === 2
          ? Math.min(130, listMaxH * 0.42)
          : matchCount <= 5
            ? Math.min(108, listMaxH / matchCount)
            : matchCount <= 8
              ? Math.min(88, listMaxH / matchCount)
              : Math.min(72, listMaxH / matchCount);
  const rowHeight = matchCount > 0 ? Math.max(52, Math.floor(ideal)) : 0;
  return { headerH, footerH, listTop, listMaxH, rowHeight, compact, sparse };
}

export function WeekendLayout({
  width,
  height,
  sector,
  matches,
  weekendLabel,
  footerSlogan,
  clubLogoUrl,
}: WeekendLayoutProps) {
  const meta = WEEKEND_SECTOR_META[sector];
  const isAgon = sector === "AGONISTICO";
  const { headerH, footerH, listTop, listMaxH, rowHeight, compact, sparse } =
    resolveLayoutMetrics(matches.length, height);
  const listHeight =
    matches.length === 0
      ? listMaxH * 0.55
      : Math.min(listMaxH, rowHeight * matches.length);

  const resolvedLogo =
    (clubLogoUrl || "").trim() || SOCIAL_BRAND.clubLogoPath;

  const root: CSSProperties = {
    position: "relative",
    width,
    height,
    overflow: "hidden",
    color: "#fff",
    fontFamily: SOCIAL_BRAND.bodyFont,
    background: isAgon
      ? `linear-gradient(180deg, ${SOCIAL_BRAND.night} 0%, #0a2758 42%, ${SOCIAL_BRAND.primaryDeep} 100%)`
      : `linear-gradient(180deg, #0a3d8f 0%, ${SOCIAL_BRAND.primary} 38%, #07225a 100%)`,
  };

  return (
    <div style={root} data-weekend-sector={sector} data-match-count={matches.length}>
      <div
        style={{
          position: "absolute",
          inset: `0 0 ${height - headerH}px 0`,
          background: isAgon
            ? "radial-gradient(ellipse at 70% 20%, rgba(30,200,255,0.28), transparent 55%), linear-gradient(180deg, rgba(2,20,51,0.2), rgba(2,20,51,0.85))"
            : "radial-gradient(ellipse at 65% 30%, rgba(125,211,252,0.35), transparent 50%), linear-gradient(180deg, rgba(14,116,144,0.25), rgba(11,31,99,0.75))",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: headerH * 0.15,
          right: -width * 0.08,
          width: width * 0.55,
          height: width * 0.55,
          borderRadius: "50%",
          background: isAgon
            ? "radial-gradient(circle, rgba(0,163,255,0.22), transparent 68%)"
            : "radial-gradient(circle, rgba(255,255,255,0.16), transparent 70%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: width * 0.028,
          left: width * 0.04,
          right: width * 0.04,
          display: "flex",
          alignItems: "center",
          gap: width * 0.025,
          zIndex: 2,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolvedLogo}
          alt="ASD Comun Nuovo"
          width={width * 0.12}
          height={width * 0.12}
          style={{
            width: width * 0.12,
            height: width * 0.12,
            objectFit: "contain",
            background: "rgba(255,255,255,0.08)",
            borderRadius: 12,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: SOCIAL_BRAND.displayFont,
              fontWeight: 700,
              fontSize: width * 0.042,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {SOCIAL_BRAND.clubNameFull}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: width * 0.018,
              letterSpacing: "0.28em",
              opacity: 0.9,
              fontWeight: 600,
            }}
          >
            {SOCIAL_BRAND.youthSector}
          </div>
        </div>
        <div
          style={{
            textAlign: "right",
            fontSize: width * 0.016,
            fontWeight: 700,
            letterSpacing: "0.08em",
            lineHeight: 1.35,
            opacity: 0.92,
            borderLeft: `3px solid ${SOCIAL_BRAND.accent}`,
            paddingLeft: width * 0.016,
          }}
        >
          {meta.valuesSlogan.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: width * 0.155,
          left: width * 0.04,
          right: width * 0.04,
          zIndex: 2,
        }}
      >
        <div
          style={{
            fontFamily: SOCIAL_BRAND.displayFont,
            fontWeight: 700,
            fontSize: sparse ? width * 0.078 : width * 0.068,
            lineHeight: 0.9,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            textShadow: "0 4px 0 rgba(0,0,0,0.25)",
          }}
        >
          <span style={{ display: "block", color: "#fff" }}>LE NOSTRE</span>
          <span
            style={{
              display: "block",
              color: SOCIAL_BRAND.accentBright,
              transform: "skewX(-6deg)",
              marginTop: 2,
            }}
          >
            PARTITE
          </span>
        </div>
        <div style={{ marginTop: width * 0.016 }}>
          <BrushBanner text={meta.subtitle} width={width} accent={SOCIAL_BRAND.accent} />
        </div>
        <div
          style={{
            marginTop: width * 0.016,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            color: SOCIAL_BRAND.primaryDeep,
            borderRadius: 999,
            padding: `${width * 0.011}px ${width * 0.026}px`,
            fontWeight: 800,
            fontSize: width * 0.02,
            boxShadow: "0 8px 20px rgba(0,0,0,0.2)",
          }}
        >
          <span aria-hidden>📅</span>
          {weekendLabel}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: width * 0.035,
          right: width * 0.035,
          top: sparse
            ? listTop + Math.max(0, (listMaxH - listHeight) * 0.35)
            : listTop,
          height: listHeight,
          zIndex: 3,
          borderRadius: 22,
          overflow: "hidden",
          background: "rgba(255,255,255,0.96)",
          boxShadow: "0 16px 40px rgba(0,0,0,0.28)",
          border: "1px solid rgba(255,255,255,0.65)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {matches.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "grid",
              placeItems: "center",
              padding: width * 0.06,
              textAlign: "center",
              color: SOCIAL_BRAND.primaryDeep,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: SOCIAL_BRAND.displayFont,
                  fontSize: width * 0.045,
                  fontWeight: 700,
                }}
              >
                Nessuna partita
              </div>
              <p
                style={{
                  marginTop: 10,
                  fontSize: width * 0.022,
                  fontWeight: 600,
                  opacity: 0.8,
                  lineHeight: 1.35,
                }}
              >
                Nel periodo selezionato non ci sono gare per{" "}
                {meta.subtitle.toLowerCase()} nel calendario ufficiale.
              </p>
            </div>
          </div>
        ) : (
          matches.map((row, index) => (
            <MatchRow
              key={row.eventId}
              row={row}
              width={width}
              index={index}
              sector={sector}
              rowHeight={rowHeight}
              compact={compact}
            />
          ))
        )}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: footerH,
          zIndex: 2,
          background: isAgon
            ? "linear-gradient(180deg, transparent, rgba(2,20,51,0.95) 28%, #021433)"
            : "linear-gradient(180deg, transparent, rgba(6,20,63,0.92) 30%, #06143f)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: `${width * 0.02}px ${width * 0.04}px ${width * 0.028}px`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: width * 0.03,
          }}
        >
          <div
            style={{
              fontFamily: SOCIAL_BRAND.displayFont,
              fontWeight: 700,
              fontSize: width * 0.042,
              lineHeight: 0.95,
              letterSpacing: "0.02em",
              textTransform: "uppercase",
              color: isAgon ? SOCIAL_BRAND.accentBright : "#fff",
              whiteSpace: "pre-line",
              transform: "skewX(-6deg)",
              textShadow: "0 3px 0 rgba(0,0,0,0.35)",
              flex: 1,
            }}
          >
            {footerSlogan.replace(/,\s*/g, "\n")}
          </div>
          {meta.footerValues ? (
            <div
              style={{
                textAlign: "right",
                fontSize: width * 0.015,
                fontWeight: 700,
                letterSpacing: "0.08em",
                lineHeight: 1.35,
                opacity: 0.92,
                borderLeft: `3px solid ${SOCIAL_BRAND.accent}`,
                paddingLeft: width * 0.014,
              }}
            >
              {meta.footerValues.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          ) : (
            <div
              aria-hidden
              style={{
                width: width * 0.14,
                height: width * 0.14,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 35% 35%, #fff, #9ad8ff 45%, #0b1f63 70%)",
                boxShadow: "0 0 0 4px rgba(0,163,255,0.35)",
                flexShrink: 0,
              }}
            />
          )}
        </div>
        <div
          style={{
            marginTop: width * 0.018,
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
            fontSize: width * 0.015,
            fontWeight: 600,
            opacity: 0.88,
          }}
        >
          <span>{SOCIAL_BRAND.address}</span>
          <span>{SOCIAL_BRAND.website}</span>
        </div>
      </div>
    </div>
  );
}
