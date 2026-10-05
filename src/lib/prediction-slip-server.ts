import type { PrismaClient } from "@prisma/client";
import { nowAsEuropeRomeWallClockUtc } from "@/lib/date-input";
import {
  DASHBOARD_SLIP_HISTORY_DAYS,
  isWithinDashboardHistoryWindow,
  resolveSlipLockState,
  type SlipLockState,
} from "@/lib/prediction-slip";

type SlipLockFields = {
  id: string;
  effectiveClosesAt: Date;
  lockedAt: Date | null;
};

export async function resolveAndPersistSlipLock(options: {
  prisma: PrismaClient;
  slip: SlipLockFields;
  now?: Date;
}): Promise<{ state: SlipLockState; effectiveClosesAt: Date; lockedAt: Date | null }> {
  const now = options.now ?? nowAsEuropeRomeWallClockUtc();
  const resolved = resolveSlipLockState({
    lockedAt: options.slip.lockedAt,
    effectiveClosesAt: options.slip.effectiveClosesAt,
    now,
  });

  if (resolved.shouldPersistLockedAt) {
    const updated = await options.prisma.predictionSlip.update({
      where: { id: options.slip.id },
      data: { lockedAt: now },
      select: { lockedAt: true },
    });
    return {
      state: "LOCKED",
      effectiveClosesAt: resolved.effectiveClosesAt,
      lockedAt: updated.lockedAt,
    };
  }

  return {
    state: resolved.state,
    effectiveClosesAt: resolved.effectiveClosesAt,
    lockedAt: options.slip.lockedAt,
  };
}

export type DashboardSlipCandidate = {
  id: string;
  title: string;
  prizeText: string;
  closesAt: Date;
  effectiveClosesAt: Date | null;
  lockedAt: Date | null;
  isPublished: boolean;
  hasOwnEntry: boolean;
};

/**
 * 1) published OPEN (con effectiveClosesAt)
 * 2) else most recent published LOCKED that parent played within history window
 */
export function selectDashboardPredictionSlip(
  candidates: DashboardSlipCandidate[],
  now = nowAsEuropeRomeWallClockUtc(),
): DashboardSlipCandidate | null {
  const withState = candidates
    .filter((slip) => slip.isPublished && slip.effectiveClosesAt != null)
    .map((slip) => {
      const lock = resolveSlipLockState({
        lockedAt: slip.lockedAt,
        effectiveClosesAt: slip.effectiveClosesAt!,
        now,
      });
      return { slip, lock };
    });

  const open = withState
    .filter((row) => row.lock.state === "OPEN")
    .sort(
      (a, b) =>
        a.lock.effectiveClosesAt.getTime() - b.lock.effectiveClosesAt.getTime(),
    );
  if (open[0]) return open[0].slip;

  const closedPlayed = withState
    .filter((row) => row.lock.state === "LOCKED" && row.slip.hasOwnEntry)
    .filter((row) => {
      const reference = row.slip.lockedAt ?? row.slip.effectiveClosesAt!;
      return isWithinDashboardHistoryWindow({
        referenceAt: reference,
        now,
        days: DASHBOARD_SLIP_HISTORY_DAYS,
      });
    })
    .sort((a, b) => b.slip.closesAt.getTime() - a.slip.closesAt.getTime());

  return closedPlayed[0]?.slip ?? null;
}
