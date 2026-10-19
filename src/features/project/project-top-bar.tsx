"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Box, Download, Footprints, House, LayoutGrid, LoaderCircle, Redo2, Save, Settings, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSaveProject } from "@/features/project/use-save-project";
import { cn } from "@/lib/utils";
import { selectCanRedo, selectCanUndo, selectIsDirty, usePlanStore } from "@/store/plan-store";

/** Event listened to by the 2D canvas to download the plan as an image. */
export const EXPORT_PLAN_EVENT = "homeplan:export-plan";

/** Saves with ⌘S / Ctrl+S on every project screen. */
export const useSaveShortcut = () => {
  const save = useSaveProject();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [save]);
  return save;
};

const barButton = "h-8 gap-1.5 px-2.5 text-white/80 hover:bg-white/10 hover:text-white";

/** Dark application bar of the editor and settings screens (mockup: « Maison familiale moderne | Annuler · Rétablir · Enregistrer … »). */
export const ProjectTopBar = () => {
  const pathname = usePathname();
  const planId = usePlanStore((state) => state.plan?.id);
  const planName = usePlanStore((state) => state.plan?.name ?? "");
  const isDirty = usePlanStore(selectIsDirty);
  const isSaving = usePlanStore((state) => state.isSaving);
  const canUndo = usePlanStore(selectCanUndo);
  const canRedo = usePlanStore(selectCanRedo);
  const { undo, redo } = usePlanStore.getState();
  const save = useSaveShortcut();
  const isEditor = pathname.endsWith("/editor");

  return (
    <header className="z-20 flex h-14 items-center gap-1 border-b border-white/10 bg-[#0d1830] px-3 text-white">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white">
            <Link href="/dashboard" aria-label="Tableau de bord">
              <House />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Tableau de bord</TooltipContent>
      </Tooltip>
      <span className="min-w-0 truncate px-1 text-sm font-semibold md:max-w-60" title={planName}>
        {planName}
        {isDirty ? <span className="ml-1.5 inline-block size-1.5 rounded-full bg-amber-400 align-middle" title="Modifications non enregistrées" /> : null}
      </span>
      <span className="mx-2 hidden h-5 w-px bg-white/15 md:block" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm" className={cn("text-white/70 hover:bg-white/10 hover:text-white", isEditor && "bg-white/10 text-white")}>
            <Link href={`/projects/${planId}/editor`} aria-label="Plan 2D" aria-current={isEditor ? "page" : undefined}>
              <LayoutGrid />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Plan 2D</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm" className={cn("text-white/70 hover:bg-white/10 hover:text-white", pathname.endsWith("/settings") && "bg-white/10 text-white")}>
            <Link href={`/projects/${planId}/settings`} aria-label="Paramètres du projet">
              <Settings />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Paramètres du projet</TooltipContent>
      </Tooltip>

      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" className={cn(barButton, "hidden md:inline-flex")} onClick={undo} disabled={!canUndo}>
          <Undo2 data-icon="inline-start" />
          Annuler
        </Button>
        <Button variant="ghost" size="sm" className={cn(barButton, "hidden md:inline-flex")} onClick={redo} disabled={!canRedo}>
          <Redo2 data-icon="inline-start" />
          Rétablir
        </Button>
        <Button size="sm" className="h-8 px-3" onClick={() => void save()} disabled={isSaving || !isDirty}>
          {isSaving ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
          <span className="hidden sm:inline">{isSaving ? "Enregistrement…" : "Enregistrer"}</span>
        </Button>
        {isEditor ? (
          <Button variant="ghost" size="sm" className={cn(barButton, "hidden lg:inline-flex")} onClick={() => window.dispatchEvent(new Event(EXPORT_PLAN_EVENT))}>
            <Download data-icon="inline-start" />
            Exporter
          </Button>
        ) : null}
        <Button asChild variant="ghost" size="sm" className={barButton}>
          <Link href={`/projects/${planId}/view`}>
            <Box data-icon="inline-start" />
            <span className="hidden sm:inline">Aperçu 3D</span>
          </Link>
        </Button>
        <Button asChild variant="ghost" size="sm" className={cn(barButton, "border border-white/15")}>
          <Link href={`/projects/${planId}/walk`}>
            <Footprints data-icon="inline-start" />
            <span className="hidden sm:inline">Visite intérieure</span>
          </Link>
        </Button>
      </div>
    </header>
  );
};
