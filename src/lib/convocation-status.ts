import type { ConvocationResponseStatus } from "@prisma/client";

export const CONVOCATION_RESPONSE_LABEL: Record<ConvocationResponseStatus, string> = {
  PENDING: "Senza risposta",
  PRESENT: "Presente",
  ABSENT: "Assente",
};

export const CONVOCATION_RESPONSE_BADGE_CLASS: Record<ConvocationResponseStatus, string> = {
  PENDING: "border-zinc-200 bg-zinc-50 text-zinc-700",
  PRESENT: "border-emerald-200 bg-emerald-50 text-emerald-800",
  ABSENT: "border-red-200 bg-red-50 text-red-700",
};
