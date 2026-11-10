"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderOpen, House, LayoutTemplate, Settings, UserRound, type LucideIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Accueil", mobileLabel: "Accueil", icon: House },
  { href: "/projects", label: "Mes projets", mobileLabel: "Projets", icon: FolderOpen },
  { href: "/templates", label: "Modèles", mobileLabel: "Modèles", icon: LayoutTemplate },
  { href: "/settings", label: "Paramètres", mobileLabel: "Profil", icon: Settings },
];

export interface SidebarProfile {
  name: string;
  email: string;
  initials: string;
}

const useIsActive = () => {
  const pathname = usePathname();
  return (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
};

interface AppSidebarProps {
  /** Null for a visitor without account (public pages such as /templates). */
  profile: SidebarProfile | null;
  /** The session is still loading: neither the account nor the sign-in link is known yet. */
  isProfilePending?: boolean;
}

const accountLink = (profile: SidebarProfile | null, isProfilePending: boolean) => {
  if (profile) return { href: "/settings#mon-compte", title: profile.name, subtitle: profile.email };
  if (isProfilePending) return { href: "/settings#mon-compte", title: "Mon compte", subtitle: "" };
  return { href: "/connexion", title: "Se connecter", subtitle: "Accéder à mes projets" };
};

/** Dark navigation (mockup): sidebar with « Mon compte » on desktop, bottom tab bar on mobile. */
export const AppSidebar = ({ profile, isProfilePending = false }: AppSidebarProps) => {
  const isActive = useIsActive();
  const account = accountLink(profile, isProfilePending);
  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 bg-[#0d1830] p-4 text-white md:flex">
        <BrandLogo inverted href="/dashboard" className="px-2 pt-1" />
        <nav className="flex flex-col gap-1" aria-label="Navigation principale">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white", isActive(href) && "bg-electric text-white hover:bg-electric")}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <Link href={account.href} className="mt-auto flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-electric text-sm font-semibold">
            {profile ? profile.initials : <UserRound className="size-4" aria-hidden />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{account.title}</span>
            <span className="block min-h-4 truncate text-xs text-white/55">{account.subtitle}</span>
          </span>
        </Link>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-[#0d1830] px-4 text-white md:hidden">
        <BrandLogo inverted href="/dashboard" />
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navigation mobile">
        {NAV_ITEMS.map(({ href, mobileLabel, icon: Icon }) => (
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground", isActive(href) && "text-electric")}>
            <Icon className="size-5" aria-hidden />
            {mobileLabel}
          </Link>
        ))}
      </nav>
    </>
  );
};
