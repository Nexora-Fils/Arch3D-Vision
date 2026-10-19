"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { EditorToolbar } from "@/features/editor-2d/editor-toolbar";
import { PropertiesPanel } from "@/features/editor-2d/properties-panel";
import { useEditorShortcuts } from "@/features/editor-2d/use-editor-shortcuts";
import { useActiveFloor } from "@/features/project/use-active-floor";
import { useEditorStore } from "@/store/editor-store";

/** React Konva touches the DOM canvas API: it must never render on the server. */
const EditorCanvas = dynamic(() => import("@/features/editor-2d/editor-canvas").then((module) => module.EditorCanvas), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const TOOL_HINTS: Record<string, string> = {
  select: "Cliquez pour sélectionner, glissez pour déplacer. Molette : zoom. Espace + glisser : déplacer la vue.",
  pan: "Glissez pour déplacer la zone de travail.",
  room: "Glissez sur le plan pour tracer une pièce rectangulaire. Ses quatre murs sont créés automatiquement.",
  wall: "Cliquez pour poser le départ puis la fin du mur. Les murs s'enchaînent. Échap pour terminer.",
  door: "Cliquez sur un mur pour y poser une porte.",
  window: "Cliquez sur un mur pour y poser une fenêtre.",
  furniture: "Cliquez sur le plan pour poser le meuble choisi.",
  stairs: "Cliquez sur le plan pour poser un escalier.",
  text: "Cliquez sur le plan pour ajouter un texte, puis modifiez-le dans les propriétés.",
  dimension: "Cliquez le point de départ puis le point d'arrivée de la cote.",
};

export const PlanEditor = () => {
  useEditorShortcuts();
  const floor = useActiveFloor();
  const tool = useEditorStore((state) => state.tool);

  if (!floor) return null;

  return (
    <div className="flex h-full flex-col md:flex-row">
      <EditorToolbar />
      <div className="relative min-h-0 flex-1 bg-[#e9edf2]">
        <EditorCanvas floor={floor} />
        <p className="pointer-events-none absolute top-3 left-1/2 hidden max-w-[70%] -translate-x-1/2 truncate rounded-full bg-[#0f1a33]/80 px-3 py-1 text-center text-xs text-white/85 shadow backdrop-blur md:block">
          {floor.name} · {TOOL_HINTS[tool]}
        </p>
      </div>
      <PropertiesPanel floor={floor} />
    </div>
  );
};
