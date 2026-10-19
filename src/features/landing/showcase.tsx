"use client";

import Image, { type StaticImageData } from "next/image";
import { useState } from "react";
import { ArrowRight, BedDouble, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ShowcaseProps {
  images: { src: StaticImageData; alt: string }[];
  name: string;
  area: string;
  bedrooms: number;
  /** Server action opening the demo project. */
  openAction: () => Promise<void>;
}

/** Large render of the demo house with its key figures and three switchable views. */
export const Showcase = ({ images, name, area, bedrooms, openAction }: ShowcaseProps) => {
  const [index, setIndex] = useState(0);
  return (
    <div className="flex gap-3">
      <div className="relative min-h-80 flex-1 overflow-hidden rounded-2xl bg-midnight shadow-xl">
        <Image src={images[index].src} alt={images[index].alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" aria-hidden />
        <div className="absolute bottom-5 left-5 flex flex-col gap-2 text-white">
          <p className="text-lg font-semibold">{name}</p>
          <p className="flex items-center gap-2 text-sm text-white/85">
            <Ruler className="size-4" aria-hidden /> Surface : {area}
          </p>
          <p className="flex items-center gap-2 text-sm text-white/85">
            <BedDouble className="size-4" aria-hidden /> Chambres : {bedrooms}
          </p>
          <form action={openAction} className="pt-1">
            <Button type="submit" size="sm">
              Voir le projet en détail
              <ArrowRight data-icon="inline-end" />
            </Button>
          </form>
        </div>
      </div>
      <div className="hidden w-32 flex-col gap-3 sm:flex">
        {images.map((image, imageIndex) => (
          <button
            key={image.alt}
            type="button"
            onClick={() => setIndex(imageIndex)}
            aria-pressed={index === imageIndex}
            aria-label={image.alt}
            className={cn("relative flex-1 overflow-hidden rounded-xl border-2 shadow-sm transition", index === imageIndex ? "border-electric" : "border-transparent opacity-80 hover:opacity-100")}
          >
            <Image src={image.src} alt="" fill sizes="128px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
};
