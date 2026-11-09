"use client";

import { AlertTriangle, Plus, Trash, X } from "lucide-react";
import { useState } from "react";
import { MaterialSelect } from "@/components/material-select";
import { MaterialSwatches } from "@/components/material-swatches";
import { NumberField } from "@/components/number-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { floorArea, floorBelow, formatArea, formatMeters, habitableArea, LEVEL_SLAB_THICKNESS, roomArea, roomsOutsideFloorFootprint, wallLength } from "@/domain/plan/geometry";
import { DOOR_TYPE_LABELS, FURNITURE_PRESETS, FURNITURE_TYPE_LABELS, ROOM_TYPE_LABELS, WALL_SIDE_LABELS } from "@/domain/plan/labels";
import { buildStairShape, checkStairs, doorBlockedByStair, isStairs, STAIR_TYPES, type StairType } from "@/domain/plan/stairs";
import { formatDimension } from "@/features/editor-2d/canvas/annotation-shape";
import {
  type Annotation,
  DOOR_TYPES,
  FURNITURE_TYPES,
  ROOM_TYPES,
  type Door,
  type DoorType,
  type Floor,
  type Furniture,
  type FurnitureType,
  type Room,
  type RoomType,
  type Wall,
  type Window,
} from "@/domain/plan/schema";
import { useDeleteSelection } from "@/features/editor-2d/use-delete-selection";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

interface PropertiesPanelProps {
  floor: Floor;
}

const PanelSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-3">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
    {children}
  </section>
);

const DeleteButton = ({ label }: { label: string }) => {
  const deleteSelection = useDeleteSelection();
  return (
    <Button variant="destructive" onClick={deleteSelection} className="mt-2 w-full">
      <Trash data-icon="inline-start" />
      {label}
    </Button>
  );
};

export const PropertiesPanel = ({ floor }: PropertiesPanelProps) => {
  const selection = useEditorStore((state) => state.selection);
  const plan = usePlanStore((state) => state.plan);
  const materials = plan?.materials ?? [];
  const lowerFloor = plan ? floorBelow(plan.floors, floor) : null;
  const roomsOutside = lowerFloor ? roomsOutsideFloorFootprint(floor, lowerFloor) : [];

  let content: React.ReactNode;
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
          <button type="button" onClick={() => useEditorStore.getState().select(null)} className="rounded-md p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground" aria-label="Fermer la sélection">
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-5 p-4">
          <FloorsBlock activeFloorId={floor.id} />
          {roomsOutside.length > 0 && lowerFloor ? (
            <div role="alert" className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                {roomsOutside.map((room) => room.name).join(", ")} dépasse{roomsOutside.length > 1 ? "nt" : ""} l&apos;emprise de {lowerFloor.name}.
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

/** Floor switcher, always visible at the top of the panel. */
const FloorsBlock = ({ activeFloorId }: { activeFloorId: string }) => {
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
          <input type="checkbox" checked={copyExteriorWalls} onChange={(event) => setCopyExteriorWalls(event.target.checked)} className="mt-0.5 accent-[#2563eb]" />
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

const FloorOverview = ({ floor, materialsCount }: { floor: Floor; materialsCount: number }) => {
  const { updateFloor, commit } = usePlanStore.getState();
  const { select } = useEditorStore.getState();
  return (
    <>
      <PanelSection title="Étage">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Nom</Label>
          <Input value={floor.name} onChange={(event) => updateFloor(floor.id, { name: event.target.value }, { transient: true })} onBlur={commit} />
        </div>
        <NumberField label="Hauteur sous plafond" unit="m" min={2} max={6} step={0.05} value={floor.height} onChange={(height) => updateFloor(floor.id, { height })} />
      </PanelSection>
      <Separator />
      <PanelSection title={`Pièces (${floor.rooms.length})`}>
        {floor.rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune pièce. Utilisez l&apos;outil Pièce (R) et glissez sur le plan.</p>
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

const RoomProperties = ({ room, floorId }: { room: Room; floorId: string }) => {
  const materials = usePlanStore((state) => state.plan?.materials ?? []);
  const { updateRoom, commit } = usePlanStore.getState();
  return (
    <>
      <PanelSection title="Pièce">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Nom</Label>
          <Input value={room.name} onChange={(event) => updateRoom(floorId, room.id, { name: event.target.value }, { transient: true })} onBlur={commit} />
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
          <NumberField label="Largeur" unit="m" min={0.5} max={50} step={0.1} value={room.width} onChange={(width) => updateRoom(floorId, room.id, { width })} />
          <NumberField label="Longueur" unit="m" min={0.5} max={50} step={0.1} value={room.depth} onChange={(depth) => updateRoom(floorId, room.id, { depth })} />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Surface</span>
          <span className="font-medium tabular-nums">{formatArea(roomArea(room))}</span>
        </div>
        <MaterialSelect label="Sol" materials={materials} kinds={["floor"]} value={room.floorMaterialId} onChange={(floorMaterialId) => updateRoom(floorId, room.id, { floorMaterialId })} />
        <MaterialSwatches label="Sol" materials={materials.filter((material) => material.kind === "floor")} value={room.floorMaterialId} onSelect={(floorMaterialId) => updateRoom(floorId, room.id, { floorMaterialId })} />
      </PanelSection>
      <Separator />
      <PanelSection title="Position">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Position X" unit="m" step={0.1} value={room.x} onChange={(x) => updateRoom(floorId, room.id, { x })} />
          <NumberField label="Position Y" unit="m" step={0.1} value={room.y} onChange={(y) => updateRoom(floorId, room.id, { y })} />
        </div>
        <p className="text-xs text-muted-foreground">
          Les murs attachés suivent la pièce.
        </p>
      </PanelSection>
      <DeleteButton label="Supprimer la pièce" />
    </>
  );
};

const WallProperties = ({ wall, floor }: { wall: Wall; floor: Floor }) => {
  const materials = usePlanStore((state) => state.plan?.materials ?? []);
  const { updateWall } = usePlanStore.getState();
  const room = wall.roomId ? floor.rooms.find((item) => item.id === wall.roomId) : undefined;
  const openings = floor.doors.filter((door) => door.wallId === wall.id).length + floor.windows.filter((window) => window.wallId === wall.id).length;
  return (
    <>
      <PanelSection title="Mur">
        <p className="text-sm text-muted-foreground">
          {room && wall.side ? `Mur ${WALL_SIDE_LABELS[wall.side].toLowerCase()} de « ${room.name} »` : "Mur libre"} · {formatMeters(wallLength(wall))}
          {openings > 0 ? ` · ${openings} ouverture${openings > 1 ? "s" : ""}` : ""}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Épaisseur" unit="m" min={0.05} max={1} step={0.01} value={wall.thickness} onChange={(thickness) => updateWall(floor.id, wall.id, { thickness })} />
          <NumberField label="Hauteur" unit="m" min={0.5} max={8} step={0.05} value={wall.height} onChange={(height) => updateWall(floor.id, wall.id, { height })} />
        </div>
        <MaterialSelect label="Matériau" materials={materials} kinds={["wall", "exterior"]} value={wall.materialId} onChange={(materialId) => updateWall(floor.id, wall.id, { materialId })} />
      </PanelSection>
      {!room ? (
        <>
          <Separator />
          <PanelSection title="Extrémités">
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Départ X" unit="m" step={0.1} value={wall.start.x} onChange={(x) => updateWall(floor.id, wall.id, { start: { ...wall.start, x } })} />
              <NumberField label="Départ Y" unit="m" step={0.1} value={wall.start.y} onChange={(y) => updateWall(floor.id, wall.id, { start: { ...wall.start, y } })} />
              <NumberField label="Fin X" unit="m" step={0.1} value={wall.end.x} onChange={(x) => updateWall(floor.id, wall.id, { end: { ...wall.end, x } })} />
              <NumberField label="Fin Y" unit="m" step={0.1} value={wall.end.y} onChange={(y) => updateWall(floor.id, wall.id, { end: { ...wall.end, y } })} />
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

const OffsetSlider = ({ wall, width, offset, onChange, onCommit }: { wall: Wall; width: number; offset: number; onChange: (offset: number) => void; onCommit: () => void }) => {
  const length = wallLength(wall);
  const min = Math.min(width / 2, length / 2);
  const max = Math.max(length - width / 2, length / 2);
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Position sur le mur</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{formatMeters(offset)}</span>
      </div>
      <Slider value={[offset]} min={min} max={max} step={0.05} onValueChange={([value]) => onChange(value)} onValueCommit={onCommit} aria-label="Position sur le mur" />
    </div>
  );
};

const DoorProperties = ({ door, wall, floorId }: { door: Door; wall: Wall; floorId: string }) => {
  const { updateDoor, commit } = usePlanStore.getState();
  const plan = usePlanStore((state) => state.plan);
  const floorIndex = plan?.floors.findIndex((floor) => floor.id === floorId) ?? -1;
  const blockedByStair = plan && floorIndex >= 1 && doorBlockedByStair(plan, floorIndex, door);
  return (
    <>
      <PanelSection title="Porte">
        <OffsetSlider wall={wall} width={door.width} offset={door.offset} onChange={(offset) => updateDoor(floorId, door.id, { offset }, { transient: true })} onCommit={commit} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Largeur" unit="m" min={0.5} max={3} step={0.05} value={door.width} onChange={(width) => updateDoor(floorId, door.id, { width })} />
          <NumberField label="Hauteur" unit="m" min={1.5} max={3} step={0.05} value={door.height} onChange={(height) => updateDoor(floorId, door.id, { height })} />
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
            <ToggleGroup type="single" variant="outline" value={door.swing} onValueChange={(swing) => swing && updateDoor(floorId, door.id, { swing: swing as Door["swing"] })} className="w-full">
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

const WindowProperties = ({ window, wall, floorId }: { window: Window; wall: Wall; floorId: string }) => {
  const { updateWindow, commit } = usePlanStore.getState();
  return (
    <>
      <PanelSection title="Fenêtre">
        <OffsetSlider wall={wall} width={window.width} offset={window.offset} onChange={(offset) => updateWindow(floorId, window.id, { offset }, { transient: true })} onCommit={commit} />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Largeur" unit="m" min={0.3} max={4} step={0.05} value={window.width} onChange={(width) => updateWindow(floorId, window.id, { width })} />
          <NumberField label="Hauteur" unit="m" min={0.3} max={3} step={0.05} value={window.height} onChange={(height) => updateWindow(floorId, window.id, { height })} />
          <NumberField label="Allège (hauteur du bas)" unit="m" min={0} max={2.5} step={0.05} value={window.sillHeight} onChange={(sillHeight) => updateWindow(floorId, window.id, { sillHeight })} />
        </div>
      </PanelSection>
      <DeleteButton label="Supprimer la fenêtre" />
    </>
  );
};

/** Where a flight leads, or why it does not lead upstairs. */
const StairsReport = ({ item, floorId }: { item: Furniture; floorId: string }) => {
  const plan = usePlanStore((state) => state.plan);
  if (!plan) return null;
  const floorIndex = plan.floors.findIndex((floor) => floor.id === floorId);
  const { arrivalRoom, issues } = checkStairs(plan, floorIndex, item);
  const upper = plan.floors[floorIndex + 1];
  const shape = buildStairShape(item, (plan.floors[floorIndex]?.height ?? item.height) + LEVEL_SLAB_THICKNESS);
  if (issues.length === 0) {
    return (
      <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
        Mène à : {upper?.name} · {arrivalRoom}. {shape.steps} marches de {formatMeters(Math.round(shape.riser * 1000) / 1000)}, volée de {formatMeters(Math.round(shape.flightWidth * 100) / 100)}. La flèche indique le sens de la
        montée ; la trémie est découpée automatiquement à l&apos;étage.
      </p>
    );
  }
  return (
    <ul className="grid gap-1 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
      {issues.map((issue) => (
        <li key={issue}>{issue}</li>
      ))}
      <li className="text-amber-200/70">Déplacez ou tournez l&apos;escalier (Rotation) pour que la flèche aboutisse dans un dégagement de l&apos;étage.</li>
    </ul>
  );
};

const FurnitureProperties = ({ item, floorId }: { item: Furniture; floorId: string }) => {
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
                updateFurniture(floorId, item.id, { type: type as StairType, width: preset.width, depth: preset.depth });
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
            <Select value={item.type} onValueChange={(type) => updateFurniture(floorId, item.id, { type: type as FurnitureType })}>
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
          <NumberField label="Position X" unit="m" step={0.1} value={item.x} onChange={(x) => updateFurniture(floorId, item.id, { x })} />
          <NumberField label="Position Y" unit="m" step={0.1} value={item.y} onChange={(y) => updateFurniture(floorId, item.id, { y })} />
          <NumberField label="Largeur" unit="m" min={0.1} max={10} step={0.05} value={item.width} onChange={(width) => updateFurniture(floorId, item.id, { width })} />
          <NumberField label="Profondeur" unit="m" min={0.1} max={10} step={0.05} value={item.depth} onChange={(depth) => updateFurniture(floorId, item.id, { depth })} />
          <NumberField label="Hauteur" unit="m" min={0.1} max={4} step={0.05} value={item.height} onChange={(height) => updateFurniture(floorId, item.id, { height })} />
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Couleur</Label>
            <input
              type="color"
              value={item.color}
              onChange={(event) => updateFurniture(floorId, item.id, { color: event.target.value }, { transient: true })}
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
          <Slider value={[item.rotation]} min={0} max={359} step={1} onValueChange={([rotation]) => updateFurniture(floorId, item.id, { rotation }, { transient: true })} onValueCommit={commit} aria-label="Rotation" />
        </div>
      </PanelSection>
      <DeleteButton label="Supprimer le meuble" />
    </>
  );
};

const AnnotationProperties = ({ annotation, floorId }: { annotation: Annotation; floorId: string }) => {
  const { updateAnnotation, commit } = usePlanStore.getState();
  const isText = annotation.kind === "text";
  return (
    <>
      <PanelSection title={isText ? "Texte" : "Cotation"}>
        {isText ? null : (
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Longueur mesurée</span>
            <span className="font-medium tabular-nums">{formatDimension(annotation.start, annotation.end)}</span>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">{isText ? "Contenu" : "Libellé (vide = longueur mesurée)"}</Label>
          <Input
            value={annotation.text}
            maxLength={80}
            onChange={(event) => updateAnnotation(floorId, annotation.id, { text: event.target.value }, { transient: true })}
            onBlur={commit}
          />
        </div>
      </PanelSection>
      <DeleteButton label={isText ? "Supprimer le texte" : "Supprimer la cote"} />
    </>
  );
};
