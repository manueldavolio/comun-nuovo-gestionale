export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatRoleLabel(role: string): string {
  return role
    .split("_")
    .map((chunk) => chunk[0] + chunk.slice(1).toLowerCase())
    .join(" ");
}
