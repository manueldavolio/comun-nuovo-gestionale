import type { AttendanceStatus } from "@/generated/prisma/enums";

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Presente",
  ABSENT: "Assente",
  JUSTIFIED_ABSENCE: "Assenza giustificata",
  INJURED: "Infortunato",
};

export const ATTENDANCE_STATUS_CHOICES: { value: AttendanceStatus; label: string }[] = [
  { value: "PRESENT", label: "Presente" },
  { value: "ABSENT", label: "Assente" },
  { value: "JUSTIFIED_ABSENCE", label: "Assenza giustificata" },
  { value: "INJURED", label: "Infortunato" },
];
