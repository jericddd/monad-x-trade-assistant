"use client";

import { Activity, Home, Layers, Package, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { usePendingCard } from "@/hooks/use-pending-card";
import {
  LogoLink,
  MobileNavLink,
  MobileNavLinkIndicator,
  NavLink,
} from "@/components/layout/nav-link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/packs", label: "Packs", icon: Package },
  { href: "/collection", label: "Collection", icon: Layers, showPending: true },
  { href: "/activity", label: "Activity", icon: Activity },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { hasPending } = usePendingCard();

  return (
    <header className="sticky top-0 z-40 border-b border-mp-border bg-mp-bg/90 backdrop-blur-md">
      <div className="mp-container flex items-center justify-between gap-4 py-3">
        <LogoLink />

        <nav className="hidden md:flex items-center gap-1">
          {nav.map(({ href, label, showPending }) => (
            <NavLink
              key={href}
              href={href}
              className={cn(
                "relative rounded-xl px-3 py-2 text-sm font-medium mp-focus-ring",
                pathname === href
                  ? "bg-mp-surface-raised text-mp-text"
                  : "text-mp-text-secondary hover:bg-mp-surface-raised/60 hover:text-mp-text",
              )}
            >
              {label}
              {showPending && hasPending && (
                <span
                  className="absolute right-1 top-1 h-2 w-2 rounded-full bg-mp-gold"
                  aria-label="Pending card"
                />
              )}
            </NavLink>
          ))}
          {user?.isAdmin && (
            <NavLink
              href="/admin"
              className={cn(
                "flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium mp-focus-ring",
                pathname.startsWith("/admin")
                  ? "bg-mp-surface-raised text-mp-text"
                  : "text-mp-text-secondary hover:bg-mp-surface-raised/60 hover:text-mp-text",
              )}
            >
              <Shield className="h-4 w-4" aria-hidden /> Admin
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden sm:flex items-center gap-2 text-sm text-mp-text-secondary">
                {user.xProfileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.xProfileImage} alt="" className="h-7 w-7 rounded-full ring-2 ring-mp-border" />
                ) : null}
                @{user.xUsername}
              </span>
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                Log out
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => (window.location.href = "/api/auth/x")}>
              Log in with X
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { hasPending } = usePendingCard();

  const items = [
    ...nav,
    ...(user?.isAdmin ? [{ href: "/admin", label: "Admin", icon: Shield, showPending: false }] : []),
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-mp-border bg-mp-bg/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-4 gap-1 px-2 py-2">
        {items.slice(0, 4).map(({ href, label, icon: Icon, showPending }) => {
          const isCurrent = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <MobileNavLink
              key={href}
              href={href}
              className={cn(
                "relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-xs mp-focus-ring",
                isCurrent ? "text-mp-violet-bright bg-mp-surface-raised/50" : "text-mp-muted",
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
              <MobileNavLinkIndicator />
              {showPending && hasPending && (
                <span className="absolute right-[calc(50%-18px)] top-1.5 h-2 w-2 rounded-full bg-mp-gold" />
              )}
            </MobileNavLink>
          );
        })}
      </div>
    </nav>
  );
}
