import { cn } from "@/lib/utils";
import { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full min-h-[44px] rounded-xl border border-mp-border bg-mp-bg/80 px-4 text-sm text-mp-text",
        "placeholder:text-mp-muted mp-focus-ring",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-mp-text-secondary", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full min-h-[44px] rounded-xl border border-mp-border bg-mp-bg/80 px-4 text-sm text-mp-text mp-focus-ring",
        className,
      )}
      {...props}
    />
  );
}
