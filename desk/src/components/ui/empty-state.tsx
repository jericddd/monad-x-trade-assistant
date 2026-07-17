import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-mp-border bg-mp-surface/50 px-6 py-12 text-center animate-fade-in",
        className,
      )}
    >
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-mp-surface-raised text-mp-violet-bright">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
      )}
      <p className="font-display text-lg font-semibold text-mp-text">{title}</p>
      {description && <p className="mt-2 max-w-sm text-sm text-mp-text-secondary">{description}</p>}
    </div>
  );
}
