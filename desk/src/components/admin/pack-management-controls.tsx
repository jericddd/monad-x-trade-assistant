"use client";

import { cn } from "@/lib/utils";

type AdminCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function AdminCheckbox({ checked, onChange, label }: AdminCheckboxProps) {
  return (
    <label className="inline-flex cursor-pointer items-center justify-center p-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors duration-100",
          "border-mp-text-secondary/50 bg-mp-bg",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-mp-violet-bright peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-mp-bg",
          "peer-checked:border-mp-violet-bright peer-checked:bg-mp-violet peer-checked:shadow-glow",
        )}
      >
        <svg
          viewBox="0 0 12 10"
          className={cn(
            "h-3.5 w-3.5 text-white transition-opacity",
            checked ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        >
          <path
            d="M1 5.5L4.5 9 11 1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </label>
  );
}

export function TrashButton({
  onClick,
  disabled,
  label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-mp-border",
        "text-mp-text-secondary transition-colors mp-focus-ring",
        "hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400",
        "disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14Z" />
        <path d="M10 11v6M14 11v6" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function formatPackCreatedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
