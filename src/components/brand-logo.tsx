import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  href?: string;
  className?: string;
  inverted?: boolean;
}

export const BrandLogo = ({ href = "/", className, inverted = false }: BrandLogoProps) => (
  <Link href={href} aria-label="Arch3D Vision" className={cn("flex items-center gap-2", className)}>
    <Image src="/brand-mark.png" alt="" width={32} height={32} className="size-8 shrink-0" />
    <Image
      src={inverted ? "/brand-wordmark-inverted.png" : "/brand-wordmark.png"}
      alt=""
      width={132}
      height={14}
      className="h-auto w-[132px]"
    />
  </Link>
);
