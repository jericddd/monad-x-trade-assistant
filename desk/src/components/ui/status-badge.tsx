import { cn } from "@/lib/utils";
import { displayStatus } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  UNCLAIMED: "bg-status-unclaimed/15 text-mp-violet-bright border-status-unclaimed/40",
  CLAIMING: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  CLAIMED: "bg-status-claimed/15 text-emerald-300 border-status-claimed/40",
  EXPIRED: "bg-status-expired/15 text-stone-400 border-status-expired/40",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = displayStatus(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        statusStyles[status] ?? "bg-mp-surface-raised text-mp-text-secondary border-mp-border",
        className,
      )}
      aria-label={`Status: ${label}`}
    >
      {label}
    </span>
  );
}
