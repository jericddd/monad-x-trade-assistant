"use client";

import { createContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

type NavigationContextValue = {
  startNavigation: () => void;
};

export const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setPending(false);
  }, [pathname]);

  return (
    <NavigationContext.Provider value={{ startNavigation: () => setPending(true) }}>
      {pending && (
        <div
          className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-mp-violet/20"
          role="progressbar"
          aria-label="Loading page"
        >
          <div className="h-full w-1/3 animate-progress-indeterminate bg-gradient-to-r from-mp-violet to-mp-violet-bright" />
        </div>
      )}
      {children}
    </NavigationContext.Provider>
  );
}
