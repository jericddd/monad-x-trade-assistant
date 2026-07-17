"use client";

import { usePathname } from "next/navigation";

export function PageEnter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="mp-page-enter">
      {children}
    </div>
  );
}
