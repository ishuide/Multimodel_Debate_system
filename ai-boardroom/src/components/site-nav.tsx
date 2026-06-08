'use client'

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Github, ChevronDown, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OllamaStatus } from "@/components/ollama-status";

const links = [
  { to: "/", label: "Home" },
  { to: "/boardroom", label: "Boardroom" },
  { to: "/methodologies", label: "Methodologies" },
  { to: "/architecture", label: "Architecture" },
  { to: "/resources", label: "Resources" },
] as const;

const GH = "https://github.com/ishuide/Multimodel_Debate_system";
const GH_LINKS = [
  { label: "Repository", href: GH },
  { label: "Source Code", href: `${GH}/tree/main` },
  { label: "Issues", href: `${GH}/issues` },
  { label: "Releases", href: `${GH}/releases` },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 backdrop-blur-xl bg-background/70">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent grid place-items-center shadow-[0_0_20px_oklch(0.82_0.14_80/0.4)]">
            <Gavel className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="font-display font-semibold tracking-tight">
            AI <span className="text-gradient-gold">Boardroom</span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.to;
            return (
               <Link
                key={l.to}
                href={l.to}
                className={`px-3.5 py-2 text-sm rounded-md transition-colors ${
                  active
                    ? "text-foreground bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {l.label}
              </Link>
            );
          })}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-3.5 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 inline-flex items-center gap-1">
                <Github className="h-4 w-4" /> GitHub <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {GH_LINKS.map(l => (
                <DropdownMenuItem key={l.label} asChild>
                  <a href={l.href} target="_blank" rel="noreferrer">{l.label}</a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <OllamaStatus />
          <Button asChild variant="hero" size="sm">
            <Link href="/boardroom">Open Boardroom</Link>
          </Button>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border/50 bg-background/95">
          <div className="px-6 py-4 flex flex-col gap-1">
            {links.map((l) => (
              <Link key={l.to} href={l.to} onClick={() => setOpen(false)} className="px-3 py-2 text-sm rounded-md hover:bg-secondary">
                {l.label}
              </Link>
            ))}
            <a href={GH} className="px-3 py-2 text-sm rounded-md hover:bg-secondary inline-flex items-center gap-2">
              <Github className="h-4 w-4" /> GitHub
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/50 mt-24">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row gap-4 items-center justify-between text-sm text-muted-foreground">
        <div>© {new Date().getFullYear()} AI Boardroom · Executive Decision Intelligence</div>
        <div className="flex gap-5">
          <Link href="/methodologies" className="hover:text-foreground">Methodologies</Link>
          <Link href="/architecture" className="hover:text-foreground">Architecture</Link>
          <Link href="/resources" className="hover:text-foreground">Resources</Link>
        </div>
      </div>
    </footer>
  );
}
