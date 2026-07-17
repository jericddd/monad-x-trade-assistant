import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} role="status" aria-live="polite">
      <Loader2 className="mx-spinner h-4 w-4 text-mp-violet-bright" aria-hidden />
      {label && <span>{label}</span>}
    </span>
  );
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 py-16">
      <Loader2 className="mx-spinner h-8 w-8 text-mp-violet-bright" aria-hidden />
      <p className="text-sm text-mp-text-secondary">{label}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("mp-skeleton", className)} aria-hidden />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-mp-border bg-mp-surface/80", className)}>
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-3 p-5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function ProgressBar({ indeterminate, value }: { indeterminate?: boolean; value?: number }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-mp-surface-raised"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : value}
    >
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-mp-violet to-mp-violet-bright transition-[width] duration-300",
          indeterminate && "w-1/3 animate-progress-indeterminate",
        )}
        style={!indeterminate && value !== undefined ? { width: `${value}%` } : undefined}
      />
    </div>
  );
}
