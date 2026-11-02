import type { AttendanceStatus } from "@prisma/client";
import { canStaffAccessAthleteHealthData } from "@/lib/health-data-access";

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Presente",
  ABSENT: "Assente",
  JUSTIFIED_ABSENCE: "Assenza giustificata",
  INJURED: "Infortunato",
};

/** Label per mister/dirigenti: non esporre «Infortunato». */
export const ATTENDANCE_STATUS_LABEL_NON_HEALTH: Record<AttendanceStatus, string> = {
  PRESENT: "Presente",
  ABSENT: "Assente",
  JUSTIFIED_ABSENCE: "Assenza giustificata",
  INJURED: "Assente",
};

export const ATTENDANCE_STATUS_CHOICES: { value: AttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "Presente" },
  { value: "ABSENT", label: "Assente" },
  { value: "JUSTIFIED_ABSENCE", label: "Assenza giustificata" },
  { value: "INJURED", label: "Infortunato" },
];

/** Scelte impostabili da coach/dirigenti (senza stato sanitario). */
export const ATTENDANCE_STATUS_CHOICES_NON_HEALTH: {
  value: AttendanceStatus;
  label: string;
}[] = [
  { value: "PRESENT", label: "Presente" },
  { value: "ABSENT", label: "Assente" },
  { value: "JUSTIFIED_ABSENCE", label: "Assenza giustificata" },
];

export function attendanceStatusChoicesForRole(role: string | null | undefined) {
  return canStaffAccessAthleteHealthData(role)
    ? ATTENDANCE_STATUS_CHOICES
    : ATTENDANCE_STATUS_CHOICES_NON_HEALTH;
}

export function attendanceStatusLabelForRole(
  status: AttendanceStatus,
  role: string | null | undefined,
): string {
  return canStaffAccessAthleteHealthData(role)
    ? ATTENDANCE_STATUS_LABEL[status]
    : ATTENDANCE_STATUS_LABEL_NON_HEALTH[status];
}
