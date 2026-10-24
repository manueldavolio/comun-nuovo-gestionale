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
  parseOverrides,
  type SocialAssetDto,
  type SocialGraphicDetail,
  type SocialGraphicListItem,
  type SocialGraphicOverrides,
  type SocialMatchSnapshot,
  type SocialStudioMatchDto,
} from "@/lib/social-studio/dto";
import {
  buildMatchSnapshot,
  defaultGraphicTitle,
  formatKickoffLabel,
} from "@/lib/social-studio/snapshot";
import { matchOpponentAsset, normalizeOpponentKey } from "@/lib/social-studio/opponent-key";
import { defaultHeadline } from "@/lib/social-studio/templates";

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
  const snapshot = row.sourceSnapshot as SocialMatchSnapshot;
  return {
    id: row.id,
    title: row.title,
    template: row.template,
    format: row.format,
    status: row.status,
    eventId: row.eventId,
    categoryName: snapshot?.categoryName ?? null,
    opponentName: snapshot?.opponentName ?? null,
    matchStartAt: snapshot?.startAt ?? null,
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
    sourceSnapshot: row.sourceSnapshot as SocialMatchSnapshot,
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
