"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type DialogSheetProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  dismissible?: boolean;
};

export function DialogSheet({
  open,
  onClose,
  title,
  children,
  className,
  dismissible = true,
}: DialogSheetProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [mounted, onClose, dismissible]);

  if (!mounted) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4",
        visible ? "animate-backdrop-fade-in" : "animate-backdrop-fade-out",
      )}
      onClick={dismissible ? onClose : undefined}
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
        aria-hidden
      />
      <div
        className={cn(
          "relative z-10 w-full max-h-[92vh] overflow-y-auto rounded-t-2xl border border-mp-border bg-mp-surface p-6 shadow-glow sm:max-w-md sm:rounded-2xl",
          visible
            ? "animate-slide-up-sheet sm:animate-scale-in"
            : "animate-sheet-slide-out",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {dismissible && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-lg text-mp-text-secondary transition-colors hover:bg-mp-surface-raised hover:text-mp-text mp-focus-ring"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
