import type { UserRole } from "@prisma/client";

export const STAFF_ROLE_OPTIONS: UserRole[] = ["ADMIN", "YOUTH_DIRECTOR", "COACH"];

export const roleLabelMap: Record<UserRole, string> = {
  ADMIN: "Admin",
  YOUTH_DIRECTOR: "Direttore tecnico",
  COACH: "Mister",
  PARENT: "Genitore",
};

export function buildFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export function splitFullName(name: string): { firstName: string; lastName: string } {
  const normalizedName = name.trim();
  if (!normalizedName) {
    return { firstName: "", lastName: "" };
  }

  const [firstName, ...lastNameParts] = normalizedName.split(/\s+/);
  return {
    firstName: firstName ?? "",
    lastName: lastNameParts.join(" "),
  };
}
