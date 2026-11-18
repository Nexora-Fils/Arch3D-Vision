"use client";

import { AlertTriangle, X } from "lucide-react";
import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { floorBelow, roomsOutsideFloorFootprint } from "@/domain/plan/geometry";
import type { Floor } from "@/domain/plan/schema";
import { AnnotationProperties } from "@/features/editor-2d/properties/annotation-properties";
import { DoorProperties } from "@/features/editor-2d/properties/door-properties";
import { FloorOverview, FloorsBlock } from "@/features/editor-2d/properties/floor-properties";
import { FurnitureProperties } from "@/features/editor-2d/properties/furniture-properties";
import { RoomProperties } from "@/features/editor-2d/properties/room-properties";
import { WallProperties } from "@/features/editor-2d/properties/wall-properties";
import { WindowProperties } from "@/features/editor-2d/properties/window-properties";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

interface PropertiesPanelProps {
  floor: Floor;
}

export const PropertiesPanel = ({ floor }: PropertiesPanelProps) => {
  const selection = useEditorStore((state) => state.selection);
  const plan = usePlanStore((state) => state.plan);
  const materials = plan?.materials ?? [];
  const lowerFloor = plan ? floorBelow(plan.floors, floor.level) : null;
  const roomsOutside = lowerFloor ? roomsOutsideFloorFootprint(floor, lowerFloor) : [];

  let content: ReactNode;
  if (selection?.kind === "room") {
    const room = floor.rooms.find((item) => item.id === selection.id);
    content = room ? <RoomProperties room={room} floorId={floor.id} /> : null;
  } else if (selection?.kind === "wall") {
    const wall = floor.walls.find((item) => item.id === selection.id);
    content = wall ? <WallProperties wall={wall} floor={floor} /> : null;
  } else if (selection?.kind === "door") {
    const door = floor.doors.find((item) => item.id === selection.id);
    const wall = door ? floor.walls.find((item) => item.id === door.wallId) : undefined;
    content = door && wall ? <DoorProperties door={door} wall={wall} floorId={floor.id} /> : null;
  } else if (selection?.kind === "window") {
    const window = floor.windows.find((item) => item.id === selection.id);
    const wall = window ? floor.walls.find((item) => item.id === window.wallId) : undefined;
    content = window && wall ? <WindowProperties window={window} wall={wall} floorId={floor.id} /> : null;
  } else if (selection?.kind === "furniture") {
    const item = floor.furniture.find((candidate) => candidate.id === selection.id);
    content = item ? <FurnitureProperties item={item} floorId={floor.id} /> : null;
  } else if (selection?.kind === "annotation") {
    const annotation = floor.annotations.find((candidate) => candidate.id === selection.id);
    content = annotation ? <AnnotationProperties annotation={annotation} floorId={floor.id} /> : null;
  }

  return (
    <aside className="dark flex h-64 shrink-0 flex-col border-t border-white/10 bg-[#0f1b34] text-foreground md:h-auto md:w-80 md:border-t-0 md:border-l">
      <div className="flex h-11 items-center justify-between border-b border-white/10 px-4">
        <h2 className="text-sm font-semibold">Propriétés</h2>
        {selection ? (
          <button
            type="button"
            onClick={() => useEditorStore.getState().select(null)}
            className="rounded-md p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground"
            aria-label="Fermer la sélection"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <FloorsBlock activeFloorId={floor.id} />
          {roomsOutside.length > 0 && lowerFloor ? (
            <div
              role="alert"
              className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {roomsOutside.map((room) => room.name).join(", ")} dépasse{roomsOutside.length > 1 ? "nt" : ""}{" "}
                l&apos;emprise de {lowerFloor.name}.
              </span>
            </div>
          ) : null}
          <Separator />
          {content ?? <FloorOverview floor={floor} materialsCount={materials.length} />}
        </div>
      </ScrollArea>
    </aside>
  );
};
