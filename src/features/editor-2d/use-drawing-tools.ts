"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { useState, type RefObject } from "react";
import { toast } from "sonner";
import { findWallAt, pointAlongWall, snapToGrid } from "@/domain/plan/geometry";
import { FURNITURE_PRESETS } from "@/domain/plan/labels";
import type { Floor, Vec2 } from "@/domain/plan/schema";
import { alignAndSnapWallEndpoint, alignToAxis, snapPoint, snapPointToWalls } from "@/features/editor-2d/canvas-utils";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

const MIN_ROOM_SIZE = 0.5;
const MIN_WALL_LENGTH = 0.2;
const WALL_PICK_TOLERANCE = 0.25;

interface DraftState {
  room?: { start: Vec2; end: Vec2 };
  wall?: { start: Vec2; end: Vec2 | null };
  dimension?: { start: Vec2; end: Vec2 | null };
  hover?: Vec2 | null;
}

interface DrawingToolsOptions {
  stageRef: RefObject<KonvaStage | null>;
  floor: Floor;
  lowerFloor: Floor | null;
  snapTolerance: number;
  isPanning: boolean;
}

/** Pointer handlers of the drawing tools, and the shape being drawn (room, wall, dimension, opening hover). */
export const useDrawingTools = ({ stageRef, floor, lowerFloor, snapTolerance, isPanning }: DrawingToolsOptions) => {
  const [draft, setDraft] = useState<DraftState>({});
  const tool = useEditorStore((state) => state.tool);
  const gridStep = useEditorStore((state) => state.gridStep);
  const showLowerFloor = useEditorStore((state) => state.showLowerFloor);
  const furnitureType = useEditorStore((state) => state.furnitureType);
  const { select, setTool } = useEditorStore.getState();
  const materials = usePlanStore((state) => state.plan?.materials ?? []);
  const settings = usePlanStore((state) => state.plan?.settings);

  // Drop any in-progress drawing when the tool or the floor changes.
  const draftScope = `${tool}:${floor.id}`;
  const [syncedScope, setSyncedScope] = useState(draftScope);
  if (syncedScope !== draftScope) {
    setSyncedScope(draftScope);
    setDraft({});
  }

  // --- Pointer helpers ---------------------------------------------------
  const pointerInMeters = (): Vec2 | null => {
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return null;
    return { x: (pointer.x - stage.x()) / stage.scaleX(), y: (pointer.y - stage.y()) / stage.scaleY() };
  };

  const snappedPointer = (): Vec2 | null => {
    const point = pointerInMeters();
    if (!point) return null;
    const snapped = snapPoint(point, gridStep);
    return tool === "wall" && showLowerFloor && lowerFloor
      ? snapPointToWalls(snapped, lowerFloor.walls, snapTolerance)
      : snapped;
  };
  const alignWallEndpoint = (start: Vec2, end: Vec2): Vec2 =>
    showLowerFloor && lowerFloor
      ? alignAndSnapWallEndpoint(start, end, lowerFloor.walls, snapTolerance)
      : alignToAxis(start, end);

  const isBackgroundTarget = (event: KonvaEventObject<PointerEvent>) =>
    event.target === event.target.getStage() || event.target.name() === "background";

  // --- Drawing tools -----------------------------------------------------
  const store = usePlanStore.getState();

  const handlePointerDown = (event: KonvaEventObject<PointerEvent>) => {
    if (isPanning || event.evt.button === 1 || event.evt.button === 2) return;
    const point = snappedPointer();
    if (!point) return;

    if (tool === "select") {
      if (isBackgroundTarget(event)) select(null);
      return;
    }
    if (tool === "room" && isBackgroundTarget(event)) {
      setDraft({ room: { start: point, end: point } });
      return;
    }
    if (tool === "wall") {
      const current = draft.wall;
      if (!current) {
        setDraft({ wall: { start: point, end: null } });
        return;
      }
      const end = alignWallEndpoint(current.start, point);
      if (Math.hypot(end.x - current.start.x, end.y - current.start.y) >= MIN_WALL_LENGTH) {
        const wall = store.addWall(floor.id, {
          roomId: null,
          side: null,
          start: current.start,
          end,
          thickness: settings?.defaultWallThickness ?? 0.15,
          height: floor.height,
          materialId: materials.find((material) => material.kind === "wall")?.id ?? null,
        });
        if (wall) select({ kind: "wall", id: wall.id });
      }
      setDraft({ wall: { start: end, end: null } });
      return;
    }
    if (tool === "door" || tool === "window") {
      const raw = pointerInMeters();
      const hit = raw ? findWallAt(floor, raw, WALL_PICK_TOLERANCE) : undefined;
      if (!hit) {
        toast.info("Cliquez sur un mur pour y poser l'ouverture.");
        return;
      }
      if (tool === "door") {
        const door = store.addDoor(floor.id, {
          wallId: hit.wall.id,
          offset: hit.offset,
          width: 0.9,
          height: 2.1,
          type: "standard",
          swing: "left",
        });
        if (door) select({ kind: "door", id: door.id });
      } else {
        const window = store.addWindow(floor.id, {
          wallId: hit.wall.id,
          offset: hit.offset,
          width: 1.2,
          height: 1.2,
          sillHeight: 0.9,
        });
        if (window) select({ kind: "window", id: window.id });
      }
      return;
    }
    if (tool === "furniture" || tool === "stairs") {
      const type = tool === "stairs" ? "stairs" : furnitureType;
      const preset = FURNITURE_PRESETS[type];
      const item = store.addFurniture(floor.id, { type, x: point.x, y: point.y, rotation: 0, ...preset });
      if (item) select({ kind: "furniture", id: item.id });
      setTool("select");
      return;
    }
    if (tool === "text") {
      const annotation = store.addAnnotation(floor.id, { kind: "text", start: point, end: point, text: "Texte" });
      if (annotation) select({ kind: "annotation", id: annotation.id });
      setTool("select");
      return;
    }
    if (tool === "dimension") {
      const current = draft.dimension;
      if (!current) {
        setDraft({ dimension: { start: point, end: null } });
        return;
      }
      const end = alignToAxis(current.start, point);
      if (Math.hypot(end.x - current.start.x, end.y - current.start.y) >= MIN_WALL_LENGTH) {
        const annotation = store.addAnnotation(floor.id, { kind: "dimension", start: current.start, end, text: "" });
        if (annotation) select({ kind: "annotation", id: annotation.id });
      }
      setDraft({});
    }
  };

  const handlePointerMove = () => {
    if (tool === "room" && draft.room) {
      const point = snappedPointer();
      if (point) setDraft({ room: { ...draft.room, end: point } });
      return;
    }
    if (tool === "wall" && draft.wall) {
      const point = snappedPointer();
      if (point) setDraft({ wall: { start: draft.wall.start, end: alignWallEndpoint(draft.wall.start, point) } });
      return;
    }
    if (tool === "dimension" && draft.dimension) {
      const point = snappedPointer();
      if (point)
        setDraft({ dimension: { start: draft.dimension.start, end: alignToAxis(draft.dimension.start, point) } });
      return;
    }
    if (tool === "door" || tool === "window") {
      const raw = pointerInMeters();
      const hit = raw ? findWallAt(floor, raw, WALL_PICK_TOLERANCE) : undefined;
      setDraft({ hover: hit ? pointAlongWall(hit.wall, hit.offset) : null });
    }
  };

  const handlePointerUp = () => {
    if (tool !== "room" || !draft.room) return;
    const { start, end } = draft.room;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = snapToGrid(Math.abs(end.x - start.x), gridStep);
    const depth = snapToGrid(Math.abs(end.y - start.y), gridStep);
    setDraft({});
    if (width < MIN_ROOM_SIZE || depth < MIN_ROOM_SIZE) return;
    const room = store.addRoom(floor.id, {
      name: `Pièce ${floor.rooms.length + 1}`,
      type: "other",
      x,
      y,
      width,
      depth,
      polygon: null,
      floorMaterialId: materials.find((material) => material.kind === "floor")?.id ?? null,
    });
    if (room) {
      select({ kind: "room", id: room.id });
      setTool("select");
    }
  };

  const handleContextMenu = (event: KonvaEventObject<PointerEvent>) => {
    event.evt.preventDefault();
    if (tool === "wall") setDraft({});
  };

  return { draft, handlePointerDown, handlePointerMove, handlePointerUp, handleContextMenu };
};
