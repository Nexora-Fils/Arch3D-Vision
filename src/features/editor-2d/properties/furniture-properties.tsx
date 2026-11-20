"use client";

import { NumberField } from "@/components/number-field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatMeters, LEVEL_SLAB_THICKNESS } from "@/domain/plan/geometry";
import { FURNITURE_PRESETS, FURNITURE_TYPE_LABELS } from "@/domain/plan/labels";
import { FURNITURE_TYPES, type Furniture, type FurnitureType } from "@/domain/plan/schema";
import { checkStairs } from "@/domain/plan/stair-checks";
import { buildStairShape, isStairs, STAIR_TYPES, type StairType } from "@/domain/plan/stairs";
import { DeleteButton, PanelSection } from "@/features/editor-2d/properties/parts";
import { usePlanStore } from "@/store/plan-store";

interface StairsReportProps {
  item: Furniture;
  floorId: string;
}

/** Where a flight leads, or why it does not lead upstairs. */
const StairsReport = ({ item, floorId }: StairsReportProps) => {
  const plan = usePlanStore((state) => state.plan);
  if (!plan) return null;
  const floorIndex = plan.floors.findIndex((floor) => floor.id === floorId);
  const { arrivalRoom, issues } = checkStairs(plan, floorIndex, item);
  const upper = plan.floors[floorIndex + 1];
  const shape = buildStairShape(item, (plan.floors[floorIndex]?.height ?? item.height) + LEVEL_SLAB_THICKNESS);
  if (issues.length === 0) {
    return (
      <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
        Mène à : {upper?.name} · {arrivalRoom}. {shape.steps} marches de{" "}
        {formatMeters(Math.round(shape.riser * 1000) / 1000)}, volée de{" "}
        {formatMeters(Math.round(shape.flightWidth * 100) / 100)}. La flèche indique le sens de la montée ; la trémie
        est découpée automatiquement à l&apos;étage.
      </p>
    );
  }
  return (
    <ul className="grid gap-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
      {issues.map((issue) => (
        <li key={issue}>{issue}</li>
      ))}
      <li className="text-amber-200/70">
        Déplacez ou tournez l&apos;escalier (Rotation) pour que la flèche aboutisse dans un dégagement de l&apos;étage.
      </li>
    </ul>
  );
};

interface FurniturePropertiesProps {
  item: Furniture;
  floorId: string;
}

export const FurnitureProperties = ({ item, floorId }: FurniturePropertiesProps) => {
  const { updateFurniture, commit } = usePlanStore.getState();
  return (
    <>
      {isStairs(item.type) ? <StairsReport item={item} floorId={floorId} /> : null}
      <PanelSection title={isStairs(item.type) ? "Escalier" : "Meuble"}>
        {isStairs(item.type) ? (
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Modèle</Label>
            {/* A new model takes its own footprint (a turning stair needs a wider box). */}
            <Select
              value={item.type}
              onValueChange={(type) => {
                const preset = FURNITURE_PRESETS[type as StairType];
                updateFurniture(floorId, item.id, {
                  type: type as StairType,
                  width: preset.width,
                  depth: preset.depth,
                });
              }}
            >
              <SelectTrigger className="w-full" aria-label="Modèle d'escalier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAIR_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {FURNITURE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select
              value={item.type}
              onValueChange={(type) => updateFurniture(floorId, item.id, { type: type as FurnitureType })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FURNITURE_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {FURNITURE_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Position X"
            unit="m"
            step={0.1}
            value={item.x}
            onChange={(x) => updateFurniture(floorId, item.id, { x })}
          />
          <NumberField
            label="Position Y"
            unit="m"
            step={0.1}
            value={item.y}
            onChange={(y) => updateFurniture(floorId, item.id, { y })}
          />
          <NumberField
            label="Largeur"
            unit="m"
            min={0.1}
            max={10}
            step={0.05}
            value={item.width}
            onChange={(width) => updateFurniture(floorId, item.id, { width })}
          />
          <NumberField
            label="Profondeur"
            unit="m"
            min={0.1}
            max={10}
            step={0.05}
            value={item.depth}
            onChange={(depth) => updateFurniture(floorId, item.id, { depth })}
          />
          <NumberField
            label="Hauteur"
            unit="m"
            min={0.1}
            max={4}
            step={0.05}
            value={item.height}
            onChange={(height) => updateFurniture(floorId, item.id, { height })}
          />
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Couleur</Label>
            <input
              type="color"
              value={item.color}
              onChange={(event) =>
                updateFurniture(floorId, item.id, { color: event.target.value }, { transient: true })
              }
              onBlur={commit}
              className="h-8 w-full cursor-pointer rounded-lg border bg-background p-0.5"
              aria-label="Couleur du meuble"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Rotation</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{Math.round(item.rotation)}°</span>
          </div>
          <Slider
            value={[item.rotation]}
            min={0}
            max={359}
            step={1}
            onValueChange={([rotation]) => updateFurniture(floorId, item.id, { rotation }, { transient: true })}
            onValueCommit={commit}
            aria-label="Rotation"
          />
        </div>
      </PanelSection>
      <DeleteButton label="Supprimer le meuble" />
    </>
  );
};
