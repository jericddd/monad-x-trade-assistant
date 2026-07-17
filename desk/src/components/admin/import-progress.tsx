import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/spinner";

type Step = "upload" | "preview" | "publish";

const STEPS: { id: Step; label: string }[] = [
  { id: "upload", label: "Upload" },
  { id: "preview", label: "Preview" },
  { id: "publish", label: "Publish" },
];

export function ImportStepIndicator({
  current,
  previewReady,
}: {
  current: Step | "idle";
  previewReady: boolean;
}) {
  const order: (Step | "idle")[] = ["upload", "preview", "publish"];

  return (
    <ol className="flex items-center gap-2 text-sm">
      {STEPS.map((step, idx) => {
        const done =
          (step.id === "upload" && previewReady) ||
          (step.id === "preview" && previewReady && current !== "upload");
        const active =
          (step.id === "upload" && current === "upload") ||
          (step.id === "publish" && current === "publish");
        return (
          <li key={step.id} className="flex items-center gap-2">
            {idx > 0 && <span className="text-mp-muted">→</span>}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
                done && "bg-emerald-500/15 text-emerald-300",
                active && !done && "bg-mp-violet/20 text-mp-violet-bright",
                !done && !active && "bg-mp-surface-raised text-mp-muted",
              )}
            >
              {active ? (
                <Loader2 className="mx-spinner h-3.5 w-3.5" aria-hidden />
              ) : done ? (
                <Check className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Circle className="h-3.5 w-3.5" aria-hidden />
              )}
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ImportStatusPanel({
  title,
  detail,
  progress,
  indeterminate,
}: {
  title: string;
  detail?: string;
  progress?: number;
  indeterminate?: boolean;
}) {
  return (
    <div className="rounded-xl border border-mp-violet/30 bg-mp-violet/10 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Loader2 className="mx-spinner h-5 w-5 shrink-0 text-mp-violet-bright" aria-hidden />
        <div>
          <p className="font-semibold text-mp-text">{title}</p>
          {detail && <p className="text-sm text-mp-text-secondary">{detail}</p>}
        </div>
      </div>
      <ProgressBar indeterminate={indeterminate} value={progress} />
      {!indeterminate && progress !== undefined && (
        <p className="text-right text-xs text-mp-muted">{progress}%</p>
      )}
    </div>
  );
}
