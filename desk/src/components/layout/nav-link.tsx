"use client";

import { useContext, type ReactNode } from "react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavigationContext } from "@/components/layout/navigation-provider";

function NavLinkIndicator() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return <Loader2 className="mx-spinner h-3.5 w-3.5 shrink-0 text-mp-violet-bright" aria-hidden />;
}

type NavLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
};

export function NavLink({ href, className, children, onClick }: NavLinkProps) {
  const navigation = useContext(NavigationContext);
  const pathname = usePathname();
  const isCurrent = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      onClick={() => {
        if (!isCurrent) navigation?.startNavigation();
        onClick?.();
      }}
      className={cn("transition-all duration-150 active:scale-[0.98]", className)}
      aria-current={isCurrent ? "page" : undefined}
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        {children}
        <NavLinkIndicator />
      </span>
    </Link>
  );
}

export function MobileNavLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const navigation = useContext(NavigationContext);
  const pathname = usePathname();
  const isCurrent = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link
      href={href}
      onClick={() => {
        if (!isCurrent) navigation?.startNavigation();
      }}
      className={cn("transition-all duration-150 active:scale-95", className)}
      aria-current={isCurrent ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

export function MobileNavLinkIndicator() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <Loader2
      className="mx-spinner absolute top-1 right-[calc(50%-22px)] h-3 w-3 text-mp-violet-bright"
      aria-hidden
    />
  );
}

export function LogoLink() {
  const navigation = useContext(NavigationContext);
  const pathname = usePathname();

  return (
    <Link
      href="/"
      onClick={() => {
        if (pathname !== "/") navigation?.startNavigation();
      }}
      className="flex items-center gap-2 rounded-xl font-display font-bold text-mp-text transition-transform duration-150 active:scale-[0.98] mp-focus-ring"
    >
      <LogoMark />
      <span className="hidden sm:inline">Monad Packs</span>
    </Link>
  );
}

function LogoMark() {
  const { pending } = useLinkStatus();

  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-mp-violet to-mp-violet-bright text-sm text-white shadow-glow">
      {pending ? <Loader2 className="mx-spinner h-4 w-4" aria-hidden /> : "MP"}
    </span>
  );
}
