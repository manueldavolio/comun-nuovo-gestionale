import type { AttendanceStatus, ConvocationResponseStatus } from "@prisma/client";

export type AttendanceStatusCount = Record<AttendanceStatus, number>;

export type AthleteAttendanceStat = {
  athleteId: string;
  fullName: string;
  marked: number;
  present: number;
  absent: number;
  justified: number;
  injured: number;
  presencePercent: number | null;
};

export type RecentEventSummary = {
  eventId: string;
  title: string;
  startAt: Date;
  categoryId: string;
  categoryName: string;
  attendanceTaken: boolean;
  attendanceMarked: number;
  attendancePresent: number;
  hasConvocation: boolean;
  convocationPending: number;
  convocationPresent: number;
  convocationAbsent: number;
};

export function emptyAttendanceCounts(): AttendanceStatusCount {
  return {
    PRESENT: 0,
    ABSENT: 0,
    JUSTIFIED_ABSENCE: 0,
    INJURED: 0,
  };
}

export function presencePercent(present: number, marked: number): number | null {
  if (marked <= 0) return null;
  return Math.round((present / marked) * 100);
}

export function buildAthleteAttendanceStats(
  athletes: Array<{ id: string; firstName: string; lastName: string }>,
  records: Array<{ athleteId: string; status: AttendanceStatus }>,
): AthleteAttendanceStat[] {
  const byAthlete = new Map<string, AttendanceStatusCount>();

  for (const record of records) {
    const current = byAthlete.get(record.athleteId) ?? emptyAttendanceCounts();
    current[record.status] += 1;
    byAthlete.set(record.athleteId, current);
  }

  return athletes
    .map((athlete) => {
      const counts = byAthlete.get(athlete.id) ?? emptyAttendanceCounts();
      const marked =
        counts.PRESENT + counts.ABSENT + counts.JUSTIFIED_ABSENCE + counts.INJURED;

      return {
        athleteId: athlete.id,
        fullName: `${athlete.firstName} ${athlete.lastName}`.trim(),
        marked,
        present: counts.PRESENT,
        absent: counts.ABSENT,
        justified: counts.JUSTIFIED_ABSENCE,
        injured: counts.INJURED,
        presencePercent: presencePercent(counts.PRESENT, marked),
      };
    })
    .sort((a, b) => {
      const aPct = a.presencePercent ?? -1;
      const bPct = b.presencePercent ?? -1;
      if (bPct !== aPct) return bPct - aPct;
      return a.fullName.localeCompare(b.fullName, "it");
    });
}

export function countConvocationResponses(
  responses: Array<{ responseStatus: ConvocationResponseStatus }>,
) {
  const counts = { PENDING: 0, PRESENT: 0, ABSENT: 0 };
  for (const response of responses) {
    counts[response.responseStatus] += 1;
  }
  return counts;
}
