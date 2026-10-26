import "server-only";

import type {
  Prisma,
  SocialAssetKind,
  SocialGraphicFormat,
  SocialGraphicStatus,
  SocialGraphicTemplate,
} from "@prisma/client";
import { calendarMonthBounds, parseYearMonthParam } from "@/lib/calendar-range";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import { MATCH_EVENT_TYPES } from "@/lib/parent-season";
import { prisma } from "@/lib/prisma";
import {
  assertNoSocialStudioPayloadLeak,
  isWeekendSnapshot,
  parseOverrides,
  parseSourceSnapshot,
  type SocialAssetDto,
  type SocialGraphicDetail,
  type SocialGraphicListItem,
  type SocialGraphicOverrides,
  type SocialMatchSnapshot,
  type SocialStudioMatchDto,
  type SocialWeekendMatchRow,
  type SocialWeekendSnapshot,
} from "@/lib/social-studio/dto";
import {
  buildMatchSnapshot,
  defaultGraphicTitle,
  defaultWeekendGraphicTitle,
  formatKickoffLabel,
} from "@/lib/social-studio/snapshot";
import { matchOpponentAsset, normalizeOpponentKey } from "@/lib/social-studio/opponent-key";
import { defaultHeadline } from "@/lib/social-studio/templates";
import {
  categoryMatchesSector,
  categorySortKey,
  classifyWeekendCategory,
  displayCategoryLabel,
  endOfDayUtc,
  formatMatchDayLabel,
  formatMatchTimeLabel,
  formatWeekendBannerLabel,
  formatWeekendVenueLabel,
  parseDateOnlyUtc,
  resolveOpponentDisplayName,
  sectorFromTemplate,
  templateFromSector,
  weekendBoundsContaining,
  WEEKEND_SECTOR_META,
  type WeekendSector,
} from "@/lib/social-studio/weekend-sectors";

function toListItem(row: {
  id: string;
  title: string;
  template: SocialGraphicTemplate;
  format: SocialGraphicFormat;
  status: SocialGraphicStatus;
  eventId: string | null;
  updatedAt: Date;
  sourceSnapshot: unknown;
  createdBy: { name: string | null };
  updatedBy: { name: string | null };
}): SocialGraphicListItem {
  let categoryName: string | null = null;
  let opponentName: string | null = null;
  let matchStartAt: string | null = null;
  try {
    const snapshot = parseSourceSnapshot(row.sourceSnapshot);
    if (isWeekendSnapshot(snapshot)) {
      categoryName = WEEKEND_SECTOR_META[snapshot.sector].subtitle;
      opponentName = `${snapshot.matches.length} gare`;
      matchStartAt = snapshot.rangeStart;
    } else {
      categoryName = snapshot.categoryName ?? null;
      opponentName = snapshot.opponentName ?? null;
      matchStartAt = snapshot.startAt ?? null;
    }
  } catch {
    const snapshot = row.sourceSnapshot as SocialMatchSnapshot;
    categoryName = snapshot?.categoryName ?? null;
    opponentName = snapshot?.opponentName ?? null;
    matchStartAt = snapshot?.startAt ?? null;
  }
  return {
    id: row.id,
    title: row.title,
    template: row.template,
    format: row.format,
    status: row.status,
    eventId: row.eventId,
    categoryName,
    opponentName,
    matchStartAt,
    updatedAt: row.updatedAt.toISOString(),
    createdByName: row.createdBy.name,
    updatedByName: row.updatedBy.name,
  };
}

export async function listStudioMatches(query: {
  month?: string | null;
  categoryId?: string | null;
  q?: string | null;
}): Promise<{ month: string; matches: SocialStudioMatchDto[]; categories: Array<{ id: string; name: string }> }> {
  const wallNow = nowAsEuropeRomeWallClockUtc();
  const parsed =
    parseYearMonthParam(query.month) ??
    ({
      year: wallNow.getUTCFullYear(),
      monthIndex0: wallNow.getUTCMonth(),
    } as const);
  const { start, end } = calendarMonthBounds(parsed.year, parsed.monthIndex0);
  const month = `${parsed.year}-${String(parsed.monthIndex0 + 1).padStart(2, "0")}`;
  const categoryId = (query.categoryId ?? "").trim();
  const q = (query.q ?? "").trim();

  const where: Prisma.EventWhereInput = {
    type: { in: [...MATCH_EVENT_TYPES] },
    startAt: { gte: start, lte: end },
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { opponentName: { contains: q, mode: "insensitive" } },
            { location: { contains: q, mode: "insensitive" } },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [categories, events] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.event.findMany({
      where,
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        startAt: true,
        endAt: true,
        opponentName: true,
        isHome: true,
        location: true,
        homeScore: true,
        awayScore: true,
        seasonLabel: true,
        categoryId: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  const matches = events
    .map((event) =>
      buildMatchSnapshot({
        id: event.id,
        startAt: event.startAt,
        endAt: event.endAt,
        title: event.title,
        type: event.type,
        opponentName: event.opponentName,
        isHome: event.isHome,
        location: event.location,
        homeScore: event.homeScore,
        awayScore: event.awayScore,
        seasonLabel: event.seasonLabel,
        categoryId: event.categoryId,
        categoryName: event.category?.name ?? null,
      }),
    )
    .filter((row): row is SocialMatchSnapshot => row != null);

  const payload = { month, matches, categories };
  assertNoSocialStudioPayloadLeak(payload);
  return payload;
}

export async function listWeekendStudioMatches(query: {
  sector: WeekendSector;
  from?: string | null;
  to?: string | null;
}): Promise<{
  sector: WeekendSector;
  from: string;
  to: string;
  weekendLabel: string;
  matches: SocialWeekendMatchRow[];
}> {
  const sector = query.sector;
  const wallNow = nowAsEuropeRomeWallClockUtc();
  let start: Date;
  let end: Date;
  const fromParsed = query.from ? parseDateOnlyUtc(query.from) : null;
  const toParsed = query.to ? parseDateOnlyUtc(query.to) : null;
  if (fromParsed && toParsed) {
    start = fromParsed;
    end = endOfDayUtc(toParsed);
  } else if (fromParsed) {
    const bounds = weekendBoundsContaining(fromParsed);
    start = bounds.start;
    end = bounds.end;
  } else {
    const bounds = weekendBoundsContaining(wallNow);
    start = bounds.start;
    end = bounds.end;
  }

  const events = await prisma.event.findMany({
    where: {
      type: { in: [...MATCH_EVENT_TYPES] },
      startAt: { gte: start, lte: end },
    },
    orderBy: { startAt: "asc" },
    select: {
      id: true,
      title: true,
      type: true,
      startAt: true,
      endAt: true,
      opponentName: true,
      isHome: true,
      location: true,
      homeScore: true,
      awayScore: true,
      seasonLabel: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  });

  const assets = await listSocialAssets("OPPONENT_LOGO");
  const matches: SocialWeekendMatchRow[] = [];

  for (const event of events) {
    const categoryName = event.category?.name ?? "";
    if (!categoryMatchesSector(categoryName, sector)) continue;
    const kind = classifyWeekendCategory(categoryName);
    if (!kind) continue;
    const snapshot = buildMatchSnapshot({
      id: event.id,
      startAt: event.startAt,
      endAt: event.endAt,
      title: event.title,
      type: event.type,
      opponentName: event.opponentName,
      isHome: event.isHome,
      location: event.location,
      homeScore: event.homeScore,
      awayScore: event.awayScore,
      seasonLabel: event.seasonLabel,
      categoryId: event.categoryId,
      categoryName,
    });
    if (!snapshot) continue;
    const venue = formatWeekendVenueLabel({
      isHome: snapshot.isHome,
      location: snapshot.location,
    });
    const opponentDisplay = resolveOpponentDisplayName(
      snapshot.opponentName,
      snapshot.title,
    );
    const logoMatchResolved = matchOpponentAsset(opponentDisplay, assets);
    matches.push({
      ...snapshot,
      opponentName: opponentDisplay,
      categoryKind: kind,
      displayCategory: displayCategoryLabel(kind),
      dayLabel: formatMatchDayLabel(snapshot.startAt),
      timeLabel: formatMatchTimeLabel(snapshot.startAt),
      venueSideLabel: venue.venueSideLabel,
      venueLabel: venue.venueLabel,
      opponentLogoUrl:
        logoMatchResolved.kind === "exact" || logoMatchResolved.kind === "fuzzy"
          ? logoMatchResolved.asset.publicUrl
          : null,
    });
  }

  matches.sort((a, b) => {
    const byTime = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    if (byTime !== 0) return byTime;
    return categorySortKey(a.categoryKind) - categorySortKey(b.categoryKind);
  });

  const rangeStart = start.toISOString();
  const rangeEnd = end.toISOString();
  const payload = {
    sector,
    from: rangeStart.slice(0, 10),
    to: rangeEnd.slice(0, 10),
    weekendLabel: formatWeekendBannerLabel(rangeStart, rangeEnd),
    matches,
  };
  assertNoSocialStudioPayloadLeak(payload);
  return payload;
}

export async function getStudioMatchById(eventId: string): Promise<SocialMatchSnapshot | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      title: true,
      type: true,
      startAt: true,
      endAt: true,
      opponentName: true,
      isHome: true,
      location: true,
      homeScore: true,
      awayScore: true,
      seasonLabel: true,
      categoryId: true,
      category: { select: { name: true } },
    },
  });
  if (!event) return null;
  return buildMatchSnapshot({
    id: event.id,
    startAt: event.startAt,
    endAt: event.endAt,
    title: event.title,
    type: event.type,
    opponentName: event.opponentName,
    isHome: event.isHome,
    location: event.location,
    homeScore: event.homeScore,
    awayScore: event.awayScore,
    seasonLabel: event.seasonLabel,
    categoryId: event.categoryId,
    categoryName: event.category?.name ?? null,
  });
}

export async function listSocialGraphics(query: {
  q?: string | null;
  categoryId?: string | null;
  status?: SocialGraphicStatus | null;
  from?: string | null;
  to?: string | null;
}): Promise<SocialGraphicListItem[]> {
  const q = (query.q ?? "").trim();
  const categoryId = (query.categoryId ?? "").trim();
  const status = query.status ?? undefined;
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;

  const rows = await prisma.socialGraphic.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      title: true,
      template: true,
      format: true,
      status: true,
      eventId: true,
      updatedAt: true,
      sourceSnapshot: true,
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });

  let items = rows.map(toListItem);

  if (categoryId) {
    items = items.filter((item) => {
      const snap = rows.find((r) => r.id === item.id)?.sourceSnapshot as SocialMatchSnapshot | undefined;
      return snap?.categoryId === categoryId;
    });
  }
  if (from && !Number.isNaN(from.getTime())) {
    items = items.filter((item) => item.matchStartAt && new Date(item.matchStartAt) >= from);
  }
  if (to && !Number.isNaN(to.getTime())) {
    items = items.filter((item) => item.matchStartAt && new Date(item.matchStartAt) <= to);
  }
  if (q) {
    const needle = q.toLowerCase();
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        (item.opponentName ?? "").toLowerCase().includes(needle) ||
        (item.categoryName ?? "").toLowerCase().includes(needle),
    );
  }

  assertNoSocialStudioPayloadLeak({ items });
  return items;
}

export async function getSocialGraphic(id: string): Promise<SocialGraphicDetail | null> {
  const row = await prisma.socialGraphic.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      template: true,
      format: true,
      status: true,
      eventId: true,
      updatedAt: true,
      createdAt: true,
      sourceSnapshot: true,
      overrides: true,
      previewPath: true,
      exportPath: true,
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
    },
  });
  if (!row) return null;
  const detail: SocialGraphicDetail = {
    ...toListItem(row),
    sourceSnapshot: parseSourceSnapshot(row.sourceSnapshot),
    overrides: parseOverrides(row.overrides),
    previewPath: row.previewPath,
    exportPath: row.exportPath,
    createdAt: row.createdAt.toISOString(),
  };
  assertNoSocialStudioPayloadLeak(detail);
  return detail;
}

export async function createSocialGraphic(input: {
  eventId: string;
  template: SocialGraphicTemplate;
  format: SocialGraphicFormat;
  userId: string;
  styleVariant?: string | null;
}): Promise<SocialGraphicDetail> {
  if (sectorFromTemplate(input.template)) {
    throw new Error("Usa createWeekendSocialGraphic per i template weekend.");
  }

  const snapshot = await getStudioMatchById(input.eventId);
  if (!snapshot) {
    throw new Error("Partita non trovata o non valida per Social Studio.");
  }

  const existingAssets = await listSocialAssets("OPPONENT_LOGO");
  const logoMatch = matchOpponentAsset(snapshot.opponentName ?? "", existingAssets);

  const overrides: SocialGraphicOverrides = {
    headline: defaultHeadline(input.template),
    subheadline: snapshot.categoryName,
    kickoffLabel: formatKickoffLabel(snapshot.startAt),
    venueSideLabel: snapshot.venueSide,
    clubLogoUrl: "/logo-home.png",
    clubDisplayName: "Comun Nuovo",
    backgroundColor: "#0b1f63",
    accentColor: "#0369a1",
    styleVariant: input.styleVariant === "B" ? "B" : "A",
    opponentLogoUrl:
      logoMatch.kind === "exact" || logoMatch.kind === "fuzzy"
        ? logoMatch.asset.publicUrl
        : null,
  };

  const created = await prisma.socialGraphic.create({
    data: {
      eventId: snapshot.eventId,
      template: input.template,
      format: input.format,
      title: defaultGraphicTitle(input.template, snapshot),
      sourceSnapshot: snapshot,
      overrides,
      createdById: input.userId,
      updatedById: input.userId,
    },
    select: { id: true },
  });

  const detail = await getSocialGraphic(created.id);
  if (!detail) throw new Error("Impossibile creare la bozza.");
  return detail;
}

export async function createWeekendSocialGraphic(input: {
  sector: WeekendSector;
  format: SocialGraphicFormat;
  userId: string;
  from?: string | null;
  to?: string | null;
  styleVariant?: string | null;
}): Promise<SocialGraphicDetail> {
  const packed = await listWeekendStudioMatches({
    sector: input.sector,
    from: input.from,
    to: input.to,
  });
  const meta = WEEKEND_SECTOR_META[input.sector];
  const template = templateFromSector(input.sector);
  const first = packed.matches[0] ?? null;

  const rangeStart = new Date(`${packed.from}T00:00:00.000Z`).toISOString();
  const rangeEnd = new Date(`${packed.to}T23:59:59.999Z`).toISOString();

  const snapshot: SocialWeekendSnapshot = {
    kind: "weekend",
    sector: input.sector,
    rangeStart,
    rangeEnd,
    weekendLabel: packed.weekendLabel,
    matches: packed.matches,
    eventId: first?.eventId ?? null,
    startAt: first?.startAt ?? rangeStart,
    endAt: first?.endAt ?? null,
    title: meta.subtitle,
    type: "WEEKEND",
    typeLabel: "Weekend",
    categoryId: null,
    categoryName: meta.subtitle,
    opponentName: packed.matches.length ? `${packed.matches.length} gare` : "Nessuna gara",
    isHome: null,
    venueSide: "",
    location: null,
    homeScore: null,
    awayScore: null,
    seasonLabel: first?.seasonLabel ?? null,
  };

  const overrides: SocialGraphicOverrides = {
    headline: defaultHeadline(template),
    subheadline: meta.subtitle,
    weekendLabel: packed.weekendLabel,
    footerSlogan: meta.footerSlogan.replace("\n", " "),
    clubLogoUrl: "/logo-home.png",
    clubDisplayName: "Comun Nuovo",
    backgroundColor: input.sector === "AGONISTICO" ? "#021433" : "#0b1f63",
    accentColor: "#00a3ff",
    styleVariant: input.styleVariant === "B" ? "B" : "A",
  };

  const created = await prisma.socialGraphic.create({
    data: {
      eventId: first?.eventId ?? null,
      template,
      format: input.format,
      title: defaultWeekendGraphicTitle(template, packed.weekendLabel, packed.matches.length),
      sourceSnapshot: snapshot,
      overrides,
      createdById: input.userId,
      updatedById: input.userId,
    },
    select: { id: true },
  });

  const detail = await getSocialGraphic(created.id);
  if (!detail) throw new Error("Impossibile creare la bozza weekend.");
  return detail;
}

export async function updateSocialGraphic(input: {
  id: string;
  userId: string;
  expectedUpdatedAt: string;
  title?: string;
  status?: SocialGraphicStatus;
  overrides?: SocialGraphicOverrides;
  format?: SocialGraphicFormat;
  previewPath?: string | null;
  exportPath?: string | null;
}): Promise<
  | { ok: true; graphic: SocialGraphicDetail }
  | { ok: false; reason: "conflict"; graphic: SocialGraphicDetail }
  | { ok: false; reason: "notFound" }
> {
  const current = await prisma.socialGraphic.findUnique({
    where: { id: input.id },
    select: { id: true, updatedAt: true, overrides: true },
  });
  if (!current) return { ok: false, reason: "notFound" };

  const expected = new Date(input.expectedUpdatedAt).getTime();
  if (Number.isNaN(expected) || current.updatedAt.getTime() !== expected) {
    const graphic = await getSocialGraphic(input.id);
    if (!graphic) return { ok: false, reason: "notFound" };
    return { ok: false, reason: "conflict", graphic };
  }

  const nextOverrides =
    input.overrides !== undefined
      ? { ...parseOverrides(current.overrides), ...input.overrides }
      : undefined;

  await prisma.socialGraphic.update({
    where: { id: input.id },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim() || undefined } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.format !== undefined ? { format: input.format } : {}),
      ...(nextOverrides !== undefined ? { overrides: nextOverrides } : {}),
      ...(input.previewPath !== undefined ? { previewPath: input.previewPath } : {}),
      ...(input.exportPath !== undefined ? { exportPath: input.exportPath } : {}),
      updatedById: input.userId,
    },
  });

  const graphic = await getSocialGraphic(input.id);
  if (!graphic) return { ok: false, reason: "notFound" };
  return { ok: true, graphic };
}

function toAssetDto(row: {
  id: string;
  kind: SocialAssetKind;
  label: string;
  publicUrl: string;
  normalizedKey: string | null;
  createdAt: Date;
}): SocialAssetDto {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    publicUrl: row.publicUrl,
    normalizedKey: row.normalizedKey ?? normalizeOpponentKey(row.label),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listSocialAssets(kind?: SocialAssetKind | null): Promise<SocialAssetDto[]> {
  const rows = await prisma.socialAsset.findMany({
    where: kind ? { kind } : undefined,
    orderBy: [{ label: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      kind: true,
      label: true,
      publicUrl: true,
      normalizedKey: true,
      createdAt: true,
    },
  });
  const assets = rows.map(toAssetDto);
  assertNoSocialStudioPayloadLeak({ assets });
  return assets;
}

export async function createSocialAsset(input: {
  kind: SocialAssetKind;
  label: string;
  storagePath: string;
  publicUrl: string;
  userId: string;
}): Promise<SocialAssetDto> {
  const label = input.label.trim();
  const normalizedKey =
    input.kind === "OPPONENT_LOGO" ? normalizeOpponentKey(label) || null : null;
  const row = await prisma.socialAsset.create({
    data: {
      kind: input.kind,
      label,
      normalizedKey,
      storagePath: input.storagePath,
      publicUrl: input.publicUrl,
      createdById: input.userId,
    },
    select: {
      id: true,
      kind: true,
      label: true,
      publicUrl: true,
      normalizedKey: true,
      createdAt: true,
    },
  });
  return toAssetDto(row);
}

export async function findOpponentAssetByName(name: string): Promise<SocialAssetDto | null> {
  const key = normalizeOpponentKey(name);
  if (key) {
    const byKey = await prisma.socialAsset.findFirst({
      where: { kind: "OPPONENT_LOGO", normalizedKey: key },
      select: {
        id: true,
        kind: true,
        label: true,
        publicUrl: true,
        normalizedKey: true,
        createdAt: true,
      },
    });
    if (byKey) return toAssetDto(byKey);
  }
  const assets = await listSocialAssets("OPPONENT_LOGO");
  const match = matchOpponentAsset(name, assets);
  if (match.kind === "exact") return match.asset;
  return null;
}

/**
 * Sostituisce lo stemma in archivio con un NUOVO path storage.
 * Non cancella il file precedente: le grafiche storiche che puntano al vecchio
 * publicUrl restano invariate.
 */
export async function replaceSocialAsset(input: {
  id: string;
  label: string;
  storagePath: string;
  publicUrl: string;
}): Promise<SocialAssetDto> {
  const label = input.label.trim();
  const row = await prisma.socialAsset.update({
    where: { id: input.id },
    data: {
      label,
      normalizedKey: normalizeOpponentKey(label) || null,
      storagePath: input.storagePath,
      publicUrl: input.publicUrl,
    },
    select: {
      id: true,
      kind: true,
      label: true,
      publicUrl: true,
      normalizedKey: true,
      createdAt: true,
    },
  });
  return toAssetDto(row);
}
