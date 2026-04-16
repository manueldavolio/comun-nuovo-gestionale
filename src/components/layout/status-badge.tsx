import type { ExpiryBadgeStatus } from "@/lib/expiry-status";
import { EXPIRY_BADGE_CLASSES, EXPIRY_BADGE_LABEL } from "@/lib/expiry-status";

type StatusBadgeProps = {
  status: ExpiryBadgeStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
        EXPIRY_BADGE_CLASSES[status],
      ].join(" ")}
    >
      {EXPIRY_BADGE_LABEL[status]}
    </span>
  );
}

