"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/templates", label: "Modèles" },
  { href: "/tarifs", label: "Tarifs" },
  { href: "/a-propos", label: "À propos" },
];

interface MarketingHeaderProps {
  /** Over the hero photo the bar is transparent; elsewhere it is solid. */
  transparent?: boolean;
}

export const MarketingHeader = ({ transparent = false }: MarketingHeaderProps) => {
  const pathname = usePathname();
  return (
    <header className={cn("z-30 text-white", transparent ? "absolute inset-x-0 top-0" : "sticky top-0 bg-[#0d1830]")}>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <BrandLogo inverted />
        <nav className="hidden items-center gap-6 text-sm lg:flex" aria-label="Navigation">
          {NAV_LINKS.map((link) => {
            const isActive = link.href === pathname;
            return (
              <Link key={link.href} href={link.href} className={cn("relative py-1 text-white/80 transition-colors hover:text-white", isActive && "text-white after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:rounded-full after:bg-electric")}>
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/connexion" className="text-sm text-white/85 hover:text-white">
            Se connecter
          </Link>
          <Button asChild size="sm" className="h-9 px-4">
            <Link href="/inscription">Créer mon compte</Link>
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white md:hidden" aria-label="Menu">
              <Menu />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {NAV_LINKS.map((link) => (
              <DropdownMenuItem key={link.href} asChild>
                <Link href={link.href}>{link.label}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/connexion">Se connecter</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/inscription">Créer mon compte</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export const MarketingFooter = () => (
  <footer className="border-t bg-background">
    <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground md:px-8">
      <BrandLogo />
      <nav className="flex flex-wrap gap-4" aria-label="Pied de page">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-foreground">
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  </footer>
);
