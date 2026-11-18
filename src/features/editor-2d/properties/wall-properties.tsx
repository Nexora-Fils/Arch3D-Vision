"use client";

import { MaterialSelect } from "@/components/material-select";
import { NumberField } from "@/components/number-field";
import { Separator } from "@/components/ui/separator";
import { formatMeters, wallLength } from "@/domain/plan/geometry";
import { WALL_SIDE_LABELS } from "@/domain/plan/labels";
import type { Floor, Wall } from "@/domain/plan/schema";
import { DeleteButton, PanelSection } from "@/features/editor-2d/properties/parts";
import { usePlanStore } from "@/store/plan-store";

interface WallPropertiesProps {
  wall: Wall;
  floor: Floor;
}

export const WallProperties = ({ wall, floor }: WallPropertiesProps) => {
  const materials = usePlanStore((state) => state.plan?.materials ?? []);
  const { updateWall } = usePlanStore.getState();
  const room = wall.roomId ? floor.rooms.find((item) => item.id === wall.roomId) : undefined;
  const openings =
    floor.doors.filter((door) => door.wallId === wall.id).length +
    floor.windows.filter((window) => window.wallId === wall.id).length;
  return (
    <>
      <PanelSection title="Mur">
        <p className="text-sm text-muted-foreground">
          {room && wall.side ? `Mur ${WALL_SIDE_LABELS[wall.side].toLowerCase()} de « ${room.name} »` : "Mur libre"} ·{" "}
          {formatMeters(wallLength(wall))}
          {openings > 0 ? ` · ${openings} ouverture${openings > 1 ? "s" : ""}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Épaisseur"
            unit="m"
            min={0.05}
            max={1}
            step={0.01}
            value={wall.thickness}
            onChange={(thickness) => updateWall(floor.id, wall.id, { thickness })}
          />
          <NumberField
            label="Hauteur"
            unit="m"
            min={0.5}
            max={8}
            step={0.05}
            value={wall.height}
            onChange={(height) => updateWall(floor.id, wall.id, { height })}
          />
        </div>
        <MaterialSelect
          label="Matériau"
          materials={materials}
          kinds={["wall", "exterior"]}
          value={wall.materialId}
          onChange={(materialId) => updateWall(floor.id, wall.id, { materialId })}
        />
      </PanelSection>
      {!room ? (
        <>
          <Separator />
          <PanelSection title="Extrémités">
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Départ X"
                unit="m"
                step={0.1}
                value={wall.start.x}
                onChange={(x) => updateWall(floor.id, wall.id, { start: { ...wall.start, x } })}
              />
              <NumberField
                label="Départ Y"
                unit="m"
                step={0.1}
                value={wall.start.y}
                onChange={(y) => updateWall(floor.id, wall.id, { start: { ...wall.start, y } })}
              />
              <NumberField
                label="Fin X"
                unit="m"
                step={0.1}
                value={wall.end.x}
                onChange={(x) => updateWall(floor.id, wall.id, { end: { ...wall.end, x } })}
              />
              <NumberField
                label="Fin Y"
                unit="m"
                step={0.1}
                value={wall.end.y}
                onChange={(y) => updateWall(floor.id, wall.id, { end: { ...wall.end, y } })}
              />
            </div>
          </PanelSection>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Pour déplacer ce mur, déplacez ou redimensionnez la pièce.</p>
      )}
      <DeleteButton label="Supprimer le mur" />
    </>
  );
};
