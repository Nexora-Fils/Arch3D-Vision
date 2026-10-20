"use client";

import { AppWindow, Armchair, DoorOpen, Footprints, MousePointer2, Ruler, Square, SquareDashed, Trash, Type, type LucideIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FURNITURE_TYPE_LABELS } from "@/domain/plan/labels";
import { FURNITURE_TYPES } from "@/domain/plan/schema";
import { isStairs } from "@/domain/plan/stairs";
import { useDeleteSelection } from "@/features/editor-2d/use-delete-selection";
import { cn } from "@/lib/utils";
import { useEditorStore, type EditorTool } from "@/store/editor-store";

interface ToolDefinition {
  tool: EditorTool;
  label: string;
  shortcut: string;
  icon: LucideIcon;
}

/** Same order as the mockup: Sélection, Mur, Pièce, Porte, Fenêtre, Escalier, Texte, Cotation… */
const TOOLS: ToolDefinition[] = [
  { tool: "select", label: "Sélection", shortcut: "V", icon: MousePointer2 },
  { tool: "wall", label: "Mur", shortcut: "W", icon: Square },
  { tool: "room", label: "Pièce", shortcut: "R", icon: SquareDashed },
  { tool: "door", label: "Porte", shortcut: "D", icon: DoorOpen },
  { tool: "window", label: "Fenêtre", shortcut: "F", icon: AppWindow },
  { tool: "stairs", label: "Escalier", shortcut: "E", icon: Footprints },
  { tool: "text", label: "Texte", shortcut: "T", icon: Type },
  { tool: "dimension", label: "Cotation", shortcut: "C", icon: Ruler },
];

const itemClass =
  "flex w-full shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40 md:w-full";

export const EditorToolbar = () => {
  const tool = useEditorStore((state) => state.tool);
  const setTool = useEditorStore((state) => state.setTool);
  const selection = useEditorStore((state) => state.selection);
  const furnitureType = useEditorStore((state) => state.furnitureType);
  const setFurnitureType = useEditorStore((state) => state.setFurnitureType);
  const deleteSelection = useDeleteSelection();

  return (
    <aside className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 bg-[#0f1b34] p-2 md:w-44 md:flex-col md:overflow-visible md:border-r md:border-b-0" aria-label="Outils">
      {TOOLS.map(({ tool: value, label, shortcut, icon: Icon }) => {
        const isActive = tool === value;
        return (
          <button key={value} type="button" onClick={() => setTool(value)} aria-pressed={isActive} title={`${label} (${shortcut})`} className={cn(itemClass, "w-auto", isActive && "bg-electric text-white hover:bg-electric")}>
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </button>
        );
      })}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-pressed={tool === "furniture"} title="Meuble (M)" className={cn(itemClass, "w-auto", tool === "furniture" && "bg-electric text-white hover:bg-electric")}>
            <Armchair className="size-4 shrink-0" aria-hidden />
            Meuble
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-60 p-2">
          <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">Choisir un meuble à poser</p>
          <div className="grid grid-cols-2 gap-1">
            {FURNITURE_TYPES.filter((type) => !isStairs(type)).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setFurnitureType(type);
                  setTool("furniture");
                }}
                className={cn("rounded-md border px-2 py-1.5 text-left text-xs hover:bg-muted", furnitureType === type && tool === "furniture" && "border-electric bg-electric/10")}
              >
                {FURNITURE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <span className="mx-1 my-1 hidden h-px bg-white/10 md:block" />
      <button type="button" onClick={deleteSelection} disabled={!selection} title="Supprimer (⌫)" className={cn(itemClass, "w-auto")}>
        <Trash className="size-4 shrink-0" aria-hidden />
        Supprimer
      </button>
    </aside>
  );
};
