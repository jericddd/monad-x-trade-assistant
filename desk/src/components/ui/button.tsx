import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-mp-violet text-white hover:bg-mp-violet-bright shadow-glow border border-mp-violet-bright/30",
  secondary:
    "bg-mp-surface-raised text-mp-text hover:bg-mp-surface border border-mp-border",
  ghost: "bg-transparent text-mp-text-secondary hover:bg-mp-surface-raised hover:text-mp-text border border-transparent",
  danger: "bg-red-600 text-white hover:bg-red-500 border border-red-500/40",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm min-h-[44px] sm:min-h-[36px]",
  md: "h-11 px-5 text-sm min-h-[44px]",
  lg: "h-12 px-6 text-base min-h-[44px] w-full",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold",
        "transition-[color,background-color,transform,box-shadow,border-color] duration-200 ease-mp-out",
        "active:scale-[0.97] mp-focus-ring",
        "disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";
