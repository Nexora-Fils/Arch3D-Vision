"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronDown, Moon, Sun } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMeters } from "@/domain/plan/geometry";
import { interiorNote, type DetailedHouse } from "@/features/detailed-houses/catalog";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { useViewerStore } from "@/store/viewer-store";

/** WebGL must only run in the browser. */
const DetailedHouseCanvas = dynamic(() => import("@/features/detailed-houses/detailed-house-canvas").then((module) => module.DetailedHouseCanvas), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none bg-[#0d1830]" />,
});

const glass = "border border-white/10 bg-[#0d1830]/85 text-white shadow-xl backdrop-blur-md";

/** Full-screen orbit view of a detailed (non-editable) house model, with its facts and attribution. */
export const DetailedHouseScreen = ({ house }: { house: DetailedHouse }) => {
  const timeOfDay = useViewerStore((state) => state.timeOfDay);
  const toggleTimeOfDay = useViewerStore((state) => state.toggleTimeOfDay);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [infoOpen, setInfoOpen] = useState<boolean | null>(null);
  const isInfoOpen = infoOpen ?? isDesktop;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0d1830]">
      <div className="absolute inset-0">
        <DetailedHouseCanvas house={house} />
      </div>

      <div className={cn("absolute top-3 left-3 flex max-w-sm flex-col gap-3 rounded-xl p-4", glass)}>
        <div className="flex items-center justify-between gap-3">
          <Link href="/templates" className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white">
            <ArrowLeft className="size-3.5" />
            Retour aux modèles
          </Link>
          <button
            type="button"
            onClick={() => setInfoOpen((value) => !(value ?? isDesktop))}
            aria-expanded={isInfoOpen}
            aria-controls="detailed-house-info"
            className="flex shrink-0 items-center gap-1 text-xs text-white/70 hover:text-white"
          >
            {infoOpen === null ? (
              <>
                <span className="md:hidden">Informations</span>
                <span className="hidden md:inline">Réduire</span>
              </>
            ) : isInfoOpen ? (
              "Réduire"
            ) : (
              "Informations"
            )}
            <ChevronDown className={cn("size-3.5 transition-transform", isInfoOpen && "rotate-180")} aria-hidden />
          </button>
        </div>
        <div>
          <h1 className="text-lg font-semibold">{house.name}</h1>
          <p className="text-sm text-white/70">{house.style}</p>
        </div>
        <div id="detailed-house-info" className={cn("flex-col gap-3", infoOpen === null ? "hidden md:flex" : isInfoOpen ? "flex" : "hidden")}>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded-full bg-white/15 px-2 py-0.5">Modèle détaillé</span>
            <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-200">Non modifiable</span>
          </div>
          <p className="text-sm text-white/80">{house.description}</p>
          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-white/55">Niveaux</dt>
              <dd className="font-medium">{house.levels}</dd>
            </div>
            <div>
              <dt className="text-white/55">Emprise</dt>
              <dd className="font-medium">
                {formatMeters(house.footprint.width)} × {formatMeters(house.footprint.depth)}
              </dd>
            </div>
            <div>
              <dt className="text-white/55">Hauteur</dt>
              <dd className="font-medium">{formatMeters(house.height)}</dd>
            </div>
          </dl>
          <p className="text-xs text-white/55">{interiorNote(house)} Maquette sans plan : surface habitable et nombre de pièces non renseignés.</p>
        </div>
      </div>

      <p className={cn("absolute bottom-3 left-3 max-w-md rounded-lg px-3 py-2 text-[11px] text-white/75", glass)}>
        Modèle 3D :{" "}
        <a href={house.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-white">
          « {house.sourceTitle} » par {house.author}
        </a>{" "}
        (Sketchfab), licence{" "}
        <a href={house.license.url} target="_blank" rel="noreferrer" className="underline hover:text-white">
          {house.license.name}
        </a>
        , optimisé pour le web (textures WebP, géométrie compressée){house.relit ? " ; matériaux non éclairés convertis en matériaux PBR éclairés" : ""}.
      </p>

      <div className={cn("absolute right-3 bottom-3 flex items-center gap-1 rounded-xl p-1", glass)} role="group" aria-label="Moment de la journée">
        {(
          [
            { value: "day", label: "Jour", icon: Sun },
            { value: "evening", label: "Soir", icon: Moon },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => (timeOfDay === value ? null : toggleTimeOfDay())}
            aria-pressed={timeOfDay === value}
            className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10", timeOfDay === value && "bg-electric text-white hover:bg-electric")}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
