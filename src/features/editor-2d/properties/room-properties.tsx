"use client";

import { MaterialSelect } from "@/components/material-select";
import { MaterialSwatches } from "@/components/material-swatches";
import { NumberField } from "@/components/number-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatArea, roomArea } from "@/domain/plan/geometry";
import { ROOM_TYPE_LABELS } from "@/domain/plan/labels";
import { ROOM_TYPES, type Room, type RoomType } from "@/domain/plan/schema";
import { DeleteButton, PanelSection } from "@/features/editor-2d/properties/parts";
import { usePlanStore } from "@/store/plan-store";

interface RoomPropertiesProps {
  room: Room;
  floorId: string;
}

export const RoomProperties = ({ room, floorId }: RoomPropertiesProps) => {
  const materials = usePlanStore((state) => state.plan?.materials ?? []);
  const { updateRoom, commit } = usePlanStore.getState();
  return (
    <>
      <PanelSection title="Pièce">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Nom</Label>
          <Input
            value={room.name}
            onChange={(event) => updateRoom(floorId, room.id, { name: event.target.value }, { transient: true })}
            onBlur={commit}
          />
        </div>
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={room.type} onValueChange={(type) => updateRoom(floorId, room.id, { type: type as RoomType })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROOM_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {ROOM_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Largeur"
            unit="m"
            min={0.5}
            max={50}
            step={0.1}
            value={room.width}
            onChange={(width) => updateRoom(floorId, room.id, { width })}
          />
          <NumberField
            label="Longueur"
            unit="m"
            min={0.5}
            max={50}
            step={0.1}
            value={room.depth}
            onChange={(depth) => updateRoom(floorId, room.id, { depth })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Surface</span>
          <span className="font-medium tabular-nums">{formatArea(roomArea(room))}</span>
        </div>
        <MaterialSelect
          label="Sol"
          materials={materials}
          kinds={["floor"]}
          value={room.floorMaterialId}
          onChange={(floorMaterialId) => updateRoom(floorId, room.id, { floorMaterialId })}
        />
        <MaterialSwatches
          label="Sol"
          materials={materials.filter((material) => material.kind === "floor")}
          value={room.floorMaterialId}
          onSelect={(floorMaterialId) => updateRoom(floorId, room.id, { floorMaterialId })}
        />
      </PanelSection>
      <Separator />
      <PanelSection title="Position">
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Position X"
            unit="m"
            step={0.1}
            value={room.x}
            onChange={(x) => updateRoom(floorId, room.id, { x })}
          />
          <NumberField
            label="Position Y"
            unit="m"
            step={0.1}
            value={room.y}
            onChange={(y) => updateRoom(floorId, room.id, { y })}
          />
        </div>
        <p className="text-xs text-muted-foreground">Les murs attachés suivent la pièce.</p>
      </PanelSection>
      <DeleteButton label="Supprimer la pièce" />
    </>
  );
};
