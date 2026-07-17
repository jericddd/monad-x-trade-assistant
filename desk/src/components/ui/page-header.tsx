import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-mp-text md:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-mp-text-secondary">{description}</p>}
      </div>
      {children}
    </div>
  );
}
