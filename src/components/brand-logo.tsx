import Link from "next/link";
import { House } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  href?: string;
  className?: string;
  inverted?: boolean;
}

export const BrandLogo = ({ href = "/", className, inverted = false }: BrandLogoProps) => (
  <Link href={href} className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
    <span className="flex size-8 items-center justify-center rounded-lg bg-electric text-electric-foreground">
      <House className="size-4" aria-hidden />
    </span>
    <span className={inverted ? "text-white" : "text-midnight"}>
      HomePlan <span className="text-electric">3D</span>
    </span>
  </Link>
);
