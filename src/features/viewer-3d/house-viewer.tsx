"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import { Camera, Download, RotateCw, Eye, EyeOff, Footprints, House, LayoutGrid, LoaderCircle, Moon, Mountain, Save, Settings, Share2, SlidersHorizontal, Sofa, Sun, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSaveShortcut } from "@/features/project/project-top-bar";
import { CustomizePanel } from "@/features/viewer-3d/customize-panel";
import { MaterialsPanel } from "@/features/viewer-3d/materials-panel";
import { useThumbnailCapture } from "@/features/viewer-3d/use-thumbnail-capture";
import { cn } from "@/lib/utils";
import { selectIsDirty, usePlanStore } from "@/store/plan-store";
import { CAMERA_PRESETS, useViewerStore, type CameraPreset } from "@/store/viewer-store";

/** WebGL must only run in the browser. */
const ViewerCanvas = dynamic(() => import("@/features/viewer-3d/viewer-canvas").then((module) => module.ViewerCanvas), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none bg-[#0d1830]" />,
});

const PRESET_LABELS: Record<CameraPreset, string> = {
  main: "Principale",
  threeQuarter: "Trois quarts",
  front: "Face",
  back: "Arrière",
  aerial: "Aérienne",
};

type ViewMode = "exterior" | "interior" | "aerial";

const glass = "border border-white/10 bg-[#0d1830]/85 text-white shadow-xl backdrop-blur-md";

interface RailButtonProps {
  label: string;
  onClick?: () => void;
  href?: string;
  isActive?: boolean;
  children: React.ReactNode;
}

const RailButton = ({ label, onClick, href, isActive, children }: RailButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      {href ? (
        <Link href={href} aria-label={label} className="flex size-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white">
          {children}
        </Link>
      ) : (
        <button type="button" onClick={onClick} aria-label={label} aria-pressed={isActive} className={cn("flex size-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white", isActive && "bg-electric text-white hover:bg-electric")}>
          {children}
        </button>
      )}
    </TooltipTrigger>
    <TooltipContent side="right">{label}</TooltipContent>
  </Tooltip>
);

export const HouseViewer = () => {
  const plan = usePlanStore((state) => state.plan);
  const isDirty = usePlanStore(selectIsDirty);
  const isSaving = usePlanStore((state) => state.isSaving);
  const showRoof = useViewerStore((state) => state.showRoof);
  const timeOfDay = useViewerStore((state) => state.timeOfDay);
  const autoRotate = useViewerStore((state) => state.autoRotate);
  const { toggleAutoRotate, toggleRoof, toggleTimeOfDay, requestCamera, setShowRoof, setHiddenFloors } = useViewerStore.getState();
  const [mode, setMode] = useState<ViewMode>("exterior");
  const [isPanelOpen, setPanelOpen] = useState(true);
  const [isOptionsOpen, setOptionsOpen] = useState(false);
  const sceneRef = useRef<HTMLDivElement>(null);
  const save = useSaveShortcut();
  useThumbnailCapture(sceneRef, plan?.id ?? "");

  if (!plan) return null;

  const applyMode = (next: ViewMode) => {
    setMode(next);
    if (next === "interior") {
      // Cutaway: no roof and no upper levels, seen from above at three-quarters.
      setShowRoof(false);
      setHiddenFloors(plan.floors.filter((floor) => floor.level > 0).map((floor) => floor.id));
      requestCamera("threeQuarter");
      return;
    }
    setShowRoof(true);
    setHiddenFloors([]);
    requestCamera(next === "aerial" ? "aerial" : "main");
  };

  const handleDownload = () => {
    const canvas = sceneRef.current?.querySelector("canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${plan.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Image de la maison téléchargée");
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/projects/${plan.id}/view`;
    try {
      if (navigator.share) {
        await navigator.share({ title: plan.name, text: "Découvrez ma maison sur HomePlan 3D", url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Lien du projet copié dans le presse-papiers");
    } catch {
      toast.error("Partage impossible sur cet appareil");
    }
  };

  const modes: { key: ViewMode | "walk"; label: string; icon: typeof House }[] = [
    { key: "exterior", label: "Extérieur", icon: House },
    { key: "interior", label: "Intérieur", icon: Sofa },
    { key: "aerial", label: "Vue aérienne", icon: Mountain },
    { key: "walk", label: "Visite", icon: Footprints },
  ];

  return (
    <div className="relative h-full overflow-hidden bg-[#0d1830]">
      <div ref={sceneRef} className="absolute inset-0">
        <ViewerCanvas />
      </div>

      {/* Project chip, top left. */}
      <div className={cn("absolute top-3 left-3 flex items-center gap-1 rounded-xl p-1 pr-2", glass)}>
        <Link href="/dashboard" aria-label="Tableau de bord" className="flex size-8 items-center justify-center rounded-lg bg-electric">
          <House className="size-4" />
        </Link>
        <span className="max-w-52 truncate px-2 text-sm font-semibold">{plan.name}</span>
        {isDirty ? (
          <Button size="xs" onClick={() => void save()} disabled={isSaving}>
            {isSaving ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            Enregistrer
          </Button>
        ) : null}
      </div>

      {/* Vertical tool rail, left. */}
      <div className={cn("absolute top-1/2 left-3 flex -translate-y-1/2 flex-col gap-1 rounded-xl p-1", glass)}>
        <RailButton label="Plan 2D" href={`/projects/${plan.id}/editor`}>
          <LayoutGrid className="size-4" />
        </RailButton>
        <RailButton label={showRoof ? "Masquer le toit" : "Afficher le toit"} onClick={toggleRoof} isActive={!showRoof}>
          {showRoof ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </RailButton>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Points de vue" className="flex size-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white">
                  <Camera className="size-4" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">Points de vue</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuLabel>Points de vue</DropdownMenuLabel>
            {CAMERA_PRESETS.map((preset) => (
              <DropdownMenuItem key={preset} onSelect={() => requestCamera(preset)}>
                {PRESET_LABELS[preset]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <RailButton label={autoRotate ? "Arrêter le tour automatique" : "Tour automatique"} onClick={toggleAutoRotate} isActive={autoRotate}>
          <RotateCw className="size-4" />
        </RailButton>
        <RailButton label="Télécharger l'image" onClick={handleDownload}>
          <Download className="size-4" />
        </RailButton>
        <RailButton label="Partager" onClick={() => void handleShare()}>
          <Share2 className="size-4" />
        </RailButton>
        <RailButton label="Options avancées" onClick={() => setOptionsOpen((value) => !value)} isActive={isOptionsOpen}>
          <SlidersHorizontal className="size-4" />
        </RailButton>
        <RailButton label="Paramètres du projet" href={`/projects/${plan.id}/settings`}>
          <Settings className="size-4" />
        </RailButton>
      </div>

      {/* Materials panel, right. */}
      <div className={cn("dark absolute top-3 right-3 w-64 overflow-hidden rounded-xl", glass)}>
        <button type="button" onClick={() => setPanelOpen((value) => !value)} aria-expanded={isPanelOpen} className="flex w-full items-center justify-between border-b border-white/10 px-3 py-2.5 text-sm font-semibold">
          Matériaux
          <span className="text-xs font-normal text-white/50">{isPanelOpen ? "Réduire" : "Afficher"}</span>
        </button>
        {isPanelOpen ? <MaterialsPanel plan={plan} /> : null}
      </div>

      {/* Advanced options drawer. */}
      {isOptionsOpen ? (
        <div className={cn("dark absolute top-16 left-16 flex max-h-[calc(100%-9rem)] w-80 flex-col overflow-hidden rounded-xl", glass)}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <span className="text-sm font-semibold">Options avancées</span>
            <button type="button" onClick={() => setOptionsOpen(false)} aria-label="Fermer" className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="p-4 text-foreground">
              <CustomizePanel plan={plan} />
            </div>
          </ScrollArea>
        </div>
      ) : null}

      {/* View modes, bottom left. */}
      <div className={cn("absolute bottom-3 left-3 flex items-center gap-1 rounded-xl p-1", glass)}>
        {modes.map(({ key, label, icon: Icon }) =>
          key === "walk" ? (
            <Link key={key} href={`/projects/${plan.id}/walk`} className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white">
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => applyMode(key)}
              aria-pressed={mode === key}
              className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white", mode === key && "bg-electric text-white hover:bg-electric")}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ),
        )}
      </div>

      {/* Day / evening, bottom right. */}
      <div className={cn("absolute right-3 bottom-3 flex items-center gap-1 rounded-xl p-1", glass)} role="group" aria-label="Moment de la journée">
        <span className="flex size-9 items-center justify-center text-amber-300">
          <Sun className="size-4" />
        </span>
        {(["day", "evening"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => timeOfDay !== value && toggleTimeOfDay()}
            aria-pressed={timeOfDay === value}
            className={cn("flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10 hover:text-white", timeOfDay === value && "bg-electric text-white hover:bg-electric")}
          >
            {value === "day" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            {value === "day" ? "Jour" : "Soir"}
          </button>
        ))}
      </div>

    </div>
  );
};
