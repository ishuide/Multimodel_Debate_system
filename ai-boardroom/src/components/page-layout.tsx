import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-nav";

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
