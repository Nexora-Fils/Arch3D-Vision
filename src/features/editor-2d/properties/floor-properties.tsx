"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { NumberField } from "@/components/number-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { floorArea, formatArea, habitableArea, roomArea } from "@/domain/plan/geometry";
import type { Floor } from "@/domain/plan/schema";
import { PanelSection } from "@/features/editor-2d/properties/parts";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

interface FloorsBlockProps {
  activeFloorId: string;
}

/** Floor switcher, always visible at the top of the panel. */
export const FloorsBlock = ({ activeFloorId }: FloorsBlockProps) => {
  const floors = usePlanStore((state) => state.plan?.floors ?? []);
  const { setActiveFloor } = useEditorStore.getState();
  const [copyExteriorWalls, setCopyExteriorWalls] = useState(false);
  const handleAdd = () => {
    const floor = usePlanStore.getState().addFloor(copyExteriorWalls);
    if (floor) setActiveFloor(floor.id);
  };
  return (
    <PanelSection title="Étages">
      <div className="flex flex-col gap-1">
        {floors.map((floor) => (
          <Button
            key={floor.id}
            variant={floor.id === activeFloorId ? "default" : "outline"}
            size="sm"
            className="justify-start"
            onClick={() => setActiveFloor(floor.id)}
            aria-pressed={floor.id === activeFloorId}
          >
            {floor.name}
          </Button>
        ))}
        <label className="flex items-start gap-2 px-2 py-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={copyExteriorWalls}
            onChange={(event) => setCopyExteriorWalls(event.target.checked)}
            className="mt-0.5 accent-[#2563eb]"
          />
          Reprendre les murs extérieurs du rez-de-chaussée
        </label>
        <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={handleAdd}>
          <Plus data-icon="inline-start" />
          Ajouter un étage
        </Button>
      </div>
    </PanelSection>
  );
};

interface FloorOverviewProps {
  floor: Floor;
  materialsCount: number;
}

export const FloorOverview = ({ floor, materialsCount }: FloorOverviewProps) => {
  const { updateFloor, commit } = usePlanStore.getState();
  const { select } = useEditorStore.getState();
  return (
    <>
      <PanelSection title="Étage">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Nom</Label>
          <Input
            value={floor.name}
            onChange={(event) => updateFloor(floor.id, { name: event.target.value }, { transient: true })}
            onBlur={commit}
          />
        </div>
        <NumberField
          label="Hauteur sous plafond"
          unit="m"
          min={2}
          max={6}
          step={0.05}
          value={floor.height}
          onChange={(height) => updateFloor(floor.id, { height })}
        />
      </PanelSection>
      <Separator />
      <PanelSection title={`Pièces (${floor.rooms.length})`}>
        {floor.rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune pièce. Utilisez l&apos;outil Pièce (R) et glissez sur le plan.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {floor.rooms.map((room) => (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => select({ kind: "room", id: room.id })}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="truncate">{room.name}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatArea(roomArea(room))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <dl className="grid grid-cols-2 gap-1 rounded-lg bg-muted/60 p-3 text-sm">
          <dt className="text-muted-foreground">Surface habitable</dt>
          <dd className="text-right font-medium tabular-nums">{formatArea(habitableArea(floor.rooms))}</dd>
          <dt className="text-muted-foreground">Avec garage et extérieurs</dt>
          <dd className="text-right tabular-nums">{formatArea(floorArea(floor))}</dd>
          <dt className="text-muted-foreground">Murs</dt>
          <dd className="text-right tabular-nums">{floor.walls.length}</dd>
          <dt className="text-muted-foreground">Ouvertures</dt>
          <dd className="text-right tabular-nums">{floor.doors.length + floor.windows.length}</dd>
          <dt className="text-muted-foreground">Meubles</dt>
          <dd className="text-right tabular-nums">{floor.furniture.length}</dd>
          <dt className="text-muted-foreground">Matériaux</dt>
          <dd className="text-right tabular-nums">{materialsCount}</dd>
        </dl>
      </PanelSection>
    </>
  );
};
