"use client";

import { NumberField } from "@/components/number-field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DOOR_TYPE_LABELS } from "@/domain/plan/labels";
import { DOOR_TYPES, type Door, type DoorType, type Wall } from "@/domain/plan/schema";
import { doorBlockedByStair } from "@/domain/plan/stair-checks";
import { DeleteButton, OffsetSlider, PanelSection } from "@/features/editor-2d/properties/parts";
import { usePlanStore } from "@/store/plan-store";

interface DoorPropertiesProps {
  door: Door;
  wall: Wall;
  floorId: string;
}

export const DoorProperties = ({ door, wall, floorId }: DoorPropertiesProps) => {
  const { updateDoor, commit } = usePlanStore.getState();
  const plan = usePlanStore((state) => state.plan);
  const floorIndex = plan?.floors.findIndex((floor) => floor.id === floorId) ?? -1;
  const blockedByStair = plan && floorIndex >= 1 && doorBlockedByStair(plan, floorIndex, door);
  return (
    <>
      <PanelSection title="Porte">
        <OffsetSlider
          wall={wall}
          width={door.width}
          offset={door.offset}
          onChange={(offset) => updateDoor(floorId, door.id, { offset }, { transient: true })}
          onCommit={commit}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Largeur"
            unit="m"
            min={0.5}
            max={3}
            step={0.05}
            value={door.width}
            onChange={(width) => updateDoor(floorId, door.id, { width })}
          />
          <NumberField
            label="Hauteur"
            unit="m"
            min={1.5}
            max={3}
            step={0.05}
            value={door.height}
            onChange={(height) => updateDoor(floorId, door.id, { height })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={door.type} onValueChange={(type) => updateDoor(floorId, door.id, { type: type as DoorType })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOOR_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {DOOR_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {door.type === "standard" ? (
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Sens d&apos;ouverture</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={door.swing}
              onValueChange={(swing) => swing && updateDoor(floorId, door.id, { swing: swing as Door["swing"] })}
              className="w-full"
            >
              <ToggleGroupItem value="left" className="flex-1">
                Gauche
              </ToggleGroupItem>
              <ToggleGroupItem value="right" className="flex-1">
                Droite
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        ) : null}
        {blockedByStair ? (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            Cette porte est bloquée par la trémie de l&apos;escalier sur le passage de 0,9 m devant la porte.
          </p>
        ) : null}
      </PanelSection>
      <DeleteButton label="Supprimer la porte" />
    </>
  );
};
