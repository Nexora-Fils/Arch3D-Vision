"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus, Settings } from "lucide-react";
import { MaterialSwatches } from "@/components/material-swatches";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { roomCenter } from "@/domain/plan/geometry";
import { FURNITURE_PRESETS, FURNITURE_TYPE_LABELS } from "@/domain/plan/labels";
import { FURNITURE_TYPES, type Plan } from "@/domain/plan/schema";
import { presetSwatches, STYLE_PRESETS } from "@/domain/plan/style-presets";
import { RoofFields } from "@/features/settings/roof-fields";
import { cn } from "@/lib/utils";
import { usePlanStore } from "@/store/plan-store";
import { QUALITY_LEVELS, useViewerStore, type QualityLevel } from "@/store/viewer-store";

const QUALITY_LABELS: Record<QualityLevel, string> = { auto: "Automatique", low: "Économique", high: "Élevée" };

const PanelSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
    {children}
  </section>
);

/** Advanced options of the 3D view: styles, per-room customisation, furniture, roof, display. */
export const CustomizePanel = ({ plan }: { plan: Plan }) => {
  const hiddenFloorIds = useViewerStore((state) => state.hiddenFloorIds);
  const quality = useViewerStore((state) => state.quality);
  const { setFloorVisible, setQuality } = useViewerStore.getState();
  const { applyStylePreset, updateRoom, updateWall, addFurniture } = usePlanStore.getState();

  const rooms = plan.floors.flatMap((floor) => floor.rooms.map((room) => ({ room, floor })));
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(rooms[0]?.room.id ?? null);
  const selected = rooms.find((entry) => entry.room.id === selectedRoomId) ?? rooms[0];
  const roomWalls = selected ? selected.floor.walls.filter((wall) => wall.roomId === selected.room.id) : [];
  const wallMaterialId = roomWalls.find((wall) => wall.materialId)?.materialId ?? null;
  const floorMaterials = plan.materials.filter((material) => material.kind === "floor");
  const wallMaterials = plan.materials.filter((material) => material.kind === "wall" || material.kind === "exterior");

  return (
    <div className="flex flex-col gap-5">
      <PanelSection title="Style">
        <div className="grid gap-2">
          {STYLE_PRESETS.map((preset) => {
            const swatches = presetSwatches(preset);
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyStylePreset(preset.key)}
                className="flex items-center gap-3 rounded-lg border bg-background p-2 text-left transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="flex shrink-0 -space-x-1.5">
                  {swatches.map((color, index) => (
                    <span key={index} className="size-6 rounded-full border-2 border-background shadow" style={{ backgroundColor: color }} aria-hidden />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{preset.label}</span>
                  <span className="line-clamp-2 block text-xs text-muted-foreground">{preset.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </PanelSection>
      <Separator />
      <PanelSection title="Personnaliser">
        {selected ? (
          <>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Pièce</Label>
              <Select value={selected.room.id} onValueChange={setSelectedRoomId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(({ room, floor }) => (
                    <SelectItem key={room.id} value={room.id}>
                      {plan.floors.length > 1 ? `${room.name} · ${floor.name}` : room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Sol</Label>
              <MaterialSwatches label="Sol" materials={floorMaterials} value={selected.room.floorMaterialId} onSelect={(floorMaterialId) => updateRoom(selected.floor.id, selected.room.id, { floorMaterialId })} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Murs</Label>
              <MaterialSwatches
                label="Murs"
                materials={wallMaterials}
                value={wallMaterialId}
                onSelect={(materialId) => roomWalls.forEach((wall) => updateWall(selected.floor.id, wall.id, { materialId }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">Meubles ({selected.floor.furniture.filter((item) => item.x >= selected.room.x && item.x <= selected.room.x + selected.room.width && item.y >= selected.room.y && item.y <= selected.room.y + selected.room.depth).length} dans la pièce)</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {FURNITURE_TYPES.map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className={cn("h-auto flex-col gap-1 py-2 text-[11px]")}
                    onClick={() => addFurniture(selected.floor.id, { type, ...roomCenter(selected.room), rotation: 0, ...FURNITURE_PRESETS[type] })}
                  >
                    <span className="size-4 rounded-sm" style={{ backgroundColor: FURNITURE_PRESETS[type].color }} aria-hidden />
                    {FURNITURE_TYPE_LABELS[type]}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <Plus className="mr-1 inline size-3" aria-hidden />
                Ajouté au centre de la pièce ; positionnez-le dans l&apos;éditeur 2D.
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Dessinez d&apos;abord une pièce dans l&apos;éditeur 2D.</p>
        )}
      </PanelSection>
      <Separator />
      <PanelSection title="Toiture et façade">
        <RoofFields />
      </PanelSection>
      <Separator />
      <PanelSection title="Affichage">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Qualité du rendu</Label>
          <Select value={quality} onValueChange={(value) => setQuality(value as QualityLevel)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {QUALITY_LEVELS.map((level) => (
                <SelectItem key={level} value={level}>
                  {QUALITY_LABELS[level]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {plan.floors.map((floor) => (
          <div key={floor.id} className="flex items-center justify-between">
            <Label htmlFor={`floor-${floor.id}`}>{floor.name}</Label>
            <Switch id={`floor-${floor.id}`} checked={!hiddenFloorIds.includes(floor.id)} onCheckedChange={(checked) => setFloorVisible(floor.id, checked)} />
          </div>
        ))}
        <Button asChild variant="link" className="w-fit px-0">
          <Link href={`/projects/${plan.id}/settings`}>
            <Settings data-icon="inline-start" />
            Gérer la bibliothèque de matériaux
          </Link>
        </Button>
      </PanelSection>
    </div>
  );
};
