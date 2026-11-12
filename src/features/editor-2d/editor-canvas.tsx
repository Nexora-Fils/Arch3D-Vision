"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Layer, Stage } from "react-konva";
import { toast } from "sonner";
import { findWallAt, floorBounds, isOutdoorRoom, pointAlongWall, snapToGrid } from "@/domain/plan/geometry";
import { FURNITURE_PRESETS, ROOM_TYPE_LABELS } from "@/domain/plan/labels";
import type { Floor, Vec2 } from "@/domain/plan/schema";
import { Minus, Plus } from "lucide-react";
import { buildStairFlights, isStairs, stairIssues } from "@/domain/plan/stairs";
import { AnnotationShape, DimensionLine } from "@/features/editor-2d/canvas/annotation-shape";
import { StairwellOutline } from "@/features/editor-2d/canvas/stairwell-outline";
import { DraftRoom, DraftWall, WallHoverMarker } from "@/features/editor-2d/canvas/draft-shapes";
import { FurnitureShape } from "@/features/editor-2d/canvas/furniture-shape";
import { GridLayer } from "@/features/editor-2d/canvas/grid-layer";
import { DoorShape, WindowShape } from "@/features/editor-2d/canvas/opening-shape";
import { RoomLabel, RoomShape } from "@/features/editor-2d/canvas/room-shape";
import { WallShape } from "@/features/editor-2d/canvas/wall-shape";
import { alignToAxis, snapPoint } from "@/features/editor-2d/canvas-utils";
import { patternScaleFor, usePlanImages } from "@/features/editor-2d/use-plan-images";
import { photoForMaterial } from "@/features/viewer-3d/textures";
import { EXPORT_PLAN_EVENT } from "@/features/project/project-top-bar";
import { MAX_ZOOM, MIN_ZOOM, pixelsPerMeter, useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

const ZOOM_FACTOR = 1.08;
const MIN_ROOM_SIZE = 0.5;
const MIN_WALL_LENGTH = 0.2;
const WALL_PICK_TOLERANCE = 0.25;

interface EditorCanvasProps {
  floor: Floor;
}

interface DraftState {
  room?: { start: Vec2; end: Vec2 };
  wall?: { start: Vec2; end: Vec2 | null };
  dimension?: { start: Vec2; end: Vec2 | null };
  hover?: Vec2 | null;
}

export const EditorCanvas = ({ floor }: EditorCanvasProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<KonvaStage>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [draft, setDraft] = useState<DraftState>({});
  const [isSpaceHeld, setSpaceHeld] = useState(false);
  const pinchRef = useRef<{ distance: number; center: Vec2 } | null>(null);

  const tool = useEditorStore((state) => state.tool);
  const zoom = useEditorStore((state) => state.zoom);
  const pan = useEditorStore((state) => state.pan);
  const gridStep = useEditorStore((state) => state.gridStep);
  const showGrid = useEditorStore((state) => state.showGrid);
  const showDimensions = useEditorStore((state) => state.showDimensions);
  const selection = useEditorStore((state) => state.selection);
  const furnitureType = useEditorStore((state) => state.furnitureType);
  const fitRequest = useEditorStore((state) => state.fitRequest);
  const { select, setView, setTool } = useEditorStore.getState();
  const lot = usePlanStore((state) => state.plan?.lot ?? { width: 20, depth: 15 });
  const materials = usePlanStore((state) => state.plan?.materials ?? []);
  const settings = usePlanStore((state) => state.plan?.settings);
  const plan = usePlanStore((state) => state.plan);
  // Stairwells cut in this floor by the flights coming from the level below, and stairs that lead nowhere.
  const stairwells = useMemo(() => {
    if (!plan) return [];
    const index = plan.floors.findIndex((candidate) => candidate.id === floor.id);
    return buildStairFlights(plan).filter((flight) => flight.upperIndex === index);
  }, [plan, floor.id]);
  const issues = useMemo(() => (plan ? stairIssues(plan) : new Map<string, string[]>()), [plan]);

  const showGridToggle = useEditorStore((state) => state.toggleGrid);
  const images = usePlanImages();
  const scale = pixelsPerMeter(zoom);
  const isPanning = tool === "pan" || isSpaceHeld;

  // --- Stage sizing -------------------------------------------------------
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitToLot = useCallback(() => {
    if (size.width === 0) return;
    const margin = 60;
    const nextZoom = Math.min(
      (size.width - margin * 2) / lot.width,
      (size.height - margin * 2) / lot.depth,
    ) / pixelsPerMeter(1);
    const boundedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const nextScale = pixelsPerMeter(boundedZoom);
    setView({
      zoom: boundedZoom,
      pan: { x: (size.width - lot.width * nextScale) / 2, y: (size.height - lot.depth * nextScale) / 2 },
    });
  }, [lot.depth, lot.width, setView, size.height, size.width]);

  const hasFitted = useRef(false);
  useEffect(() => {
    if (size.width > 0 && !hasFitted.current) {
      hasFitted.current = true;
      fitToLot();
    }
  }, [fitToLot, size.width]);

  useEffect(() => {
    if (fitRequest > 0) fitToLot();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to explicit fit requests
  }, [fitRequest]);

  // --- Export the plan as a PNG (top bar « Exporter ») ----------------------
  useEffect(() => {
    const onExport = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const link = document.createElement("a");
      link.download = `plan-${floor.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.png`;
      link.href = stage.toDataURL({ pixelRatio: 2 });
      link.click();
      toast.success("Plan exporté en image");
    };
    window.addEventListener(EXPORT_PLAN_EVENT, onExport);
    return () => window.removeEventListener(EXPORT_PLAN_EVENT, onExport);
  }, [floor.name]);

  // --- Space bar panning ----------------------------------------------------
  useEffect(() => {
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTyping(event.target)) {
        event.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

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
    return point ? snapPoint(point, gridStep) : null;
  };

  const isBackgroundTarget = (event: KonvaEventObject<PointerEvent>) =>
    event.target === event.target.getStage() || event.target.name() === "background";

  // --- Zoom with the wheel, keeping the point under the cursor fixed ------
  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, direction > 0 ? zoom * ZOOM_FACTOR : zoom / ZOOM_FACTOR));
    const nextScale = pixelsPerMeter(nextZoom);
    const worldPoint = { x: (pointer.x - pan.x) / scale, y: (pointer.y - pan.y) / scale };
    setView({ zoom: nextZoom, pan: { x: pointer.x - worldPoint.x * nextScale, y: pointer.y - worldPoint.y * nextScale } });
  };

  // --- Touch pinch zoom ----------------------------------------------------
  const handleTouchMove = (event: KonvaEventObject<TouchEvent>) => {
    const touches = event.evt.touches;
    if (touches.length !== 2) return;
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    stage.stopDrag();
    const rect = stage.container().getBoundingClientRect();
    const first = { x: touches[0].clientX - rect.left, y: touches[0].clientY - rect.top };
    const second = { x: touches[1].clientX - rect.left, y: touches[1].clientY - rect.top };
    const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    const previous = pinchRef.current;
    if (!previous) {
      pinchRef.current = { distance, center };
      return;
    }
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (distance / previous.distance)));
    const nextScale = pixelsPerMeter(nextZoom);
    const worldPoint = { x: (previous.center.x - pan.x) / scale, y: (previous.center.y - pan.y) / scale };
    setView({ zoom: nextZoom, pan: { x: center.x - worldPoint.x * nextScale, y: center.y - worldPoint.y * nextScale } });
    pinchRef.current = { distance, center };
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

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
      const end = alignToAxis(current.start, point);
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
        const door = store.addDoor(floor.id, { wallId: hit.wall.id, offset: hit.offset, width: 0.9, height: 2.1, type: "standard", swing: "left" });
        if (door) select({ kind: "door", id: door.id });
      } else {
        const window = store.addWindow(floor.id, { wallId: hit.wall.id, offset: hit.offset, width: 1.2, height: 1.2, sillHeight: 0.9 });
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
      if (point) setDraft({ wall: { start: draft.wall.start, end: alignToAxis(draft.wall.start, point) } });
      return;
    }
    if (tool === "dimension" && draft.dimension) {
      const point = snappedPointer();
      if (point) setDraft({ dimension: { start: draft.dimension.start, end: alignToAxis(draft.dimension.start, point) } });
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

  const handleDragEnd = (event: KonvaEventObject<DragEvent>) => {
    if (event.target === stageRef.current) {
      setView({ pan: { x: event.target.x(), y: event.target.y() } });
    }
  };

  const handleContextMenu = (event: KonvaEventObject<PointerEvent>) => {
    event.evt.preventDefault();
    if (tool === "wall") setDraft({});
  };

  const cursor = isPanning ? "grab" : tool === "select" ? "default" : "crosshair";
  const materialColor = (materialId: string | null) => materials.find((material) => material.id === materialId)?.color;
  const floorPatternFor = (materialId: string | null) => {
    const material = materials.find((candidate) => candidate.id === materialId);
    if (!material) return undefined;
    const key = photoForMaterial(material);
    const image = images[key];
    return image ? { image, scale: patternScaleFor(key) } : undefined;
  };
  const renderFurniture = (item: Floor["furniture"][number]) => (
    <FurnitureShape
      key={item.id}
      item={item}
      floorId={floor.id}
      gridStep={gridStep}
      isSelected={selection?.kind === "furniture" && selection.id === item.id}
      isInteractive={tool === "select"}
      hasIssue={issues.has(item.id)}
    />
  );
  const houseBounds = floorBounds({ ...floor, rooms: floor.rooms.filter((room) => !isOutdoorRoom(room)) }, { indoorOnly: true });
  const scaleBarMeters = scale >= 40 ? 5 : scale >= 15 ? 10 : 20;
  const zoomBy = (factor: number) => setView({ zoom: zoom * factor });

  return (
    <div ref={containerRef} className="canvas-surface absolute inset-0" style={{ cursor }}>
      {size.width > 0 ? (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={pan.x}
          y={pan.y}
          scaleX={scale}
          scaleY={scale}
          draggable={isPanning || tool === "select"}
          onWheel={handleWheel}
          onDragEnd={handleDragEnd}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onContextMenu={handleContextMenu}
        >
          <Layer listening={false}>
            <GridLayer lot={lot} scale={scale} showGrid={showGrid} viewport={{ pan, size }} grassImage={images.grass ?? null} />
          </Layer>
          <Layer>
            {floor.rooms.map((room) => (
              <RoomShape
                key={room.id}
                room={room}
                floorId={floor.id}
                gridStep={gridStep}
                isSelected={selection?.kind === "room" && selection.id === room.id}
                isInteractive={tool === "select"}
                showDimensions={showDimensions}
                floorColor={materialColor(room.floorMaterialId)}
                floorPattern={floorPatternFor(room.floorMaterialId)}
              />
            ))}
            {floor.walls.map((wall) => (
              <WallShape
                key={wall.id}
                wall={wall}
                floorId={floor.id}
                gridStep={gridStep}
                isSelected={selection?.kind === "wall" && selection.id === wall.id}
                isInteractive={tool === "select"}
              />
            ))}
            {floor.doors.map((door) => {
              const wall = floor.walls.find((candidate) => candidate.id === door.wallId);
              return wall ? (
                <DoorShape
                  key={door.id}
                  door={door}
                  wall={wall}
                  floorId={floor.id}
                  isSelected={selection?.kind === "door" && selection.id === door.id}
                  isInteractive={tool === "select"}
                />
              ) : null;
            })}
            {floor.windows.map((window) => {
              const wall = floor.walls.find((candidate) => candidate.id === window.wallId);
              return wall ? (
                <WindowShape
                  key={window.id}
                  window={window}
                  wall={wall}
                  floorId={floor.id}
                  isSelected={selection?.kind === "window" && selection.id === window.id}
                  isInteractive={tool === "select"}
                />
              ) : null;
            })}
            {stairwells.map((flight) => (
              <StairwellOutline key={flight.id} flight={flight} />
            ))}
            {floor.furniture.filter((item) => !isStairs(item.type)).map(renderFurniture)}
            {floor.rooms.map((room) => (
              <RoomLabel key={`label-${room.id}`} room={room} showDimensions={showDimensions} typeLabel={ROOM_TYPE_LABELS[room.type]} />
            ))}
            {floor.furniture.filter((item) => isStairs(item.type)).map(renderFurniture)}
            {floor.annotations.map((annotation) => (
              <AnnotationShape
                key={annotation.id}
                annotation={annotation}
                floorId={floor.id}
                gridStep={gridStep}
                isSelected={selection?.kind === "annotation" && selection.id === annotation.id}
                isInteractive={tool === "select"}
              />
            ))}
            {showDimensions && houseBounds ? (
              <>
                <DimensionLine start={{ x: houseBounds.minX, y: houseBounds.minY - 0.9 }} end={{ x: houseBounds.maxX, y: houseBounds.minY - 0.9 }} />
                <DimensionLine start={{ x: houseBounds.minX - 0.9, y: houseBounds.maxY }} end={{ x: houseBounds.minX - 0.9, y: houseBounds.minY }} />
              </>
            ) : null}
            {draft.dimension?.end ? <DimensionLine start={draft.dimension.start} end={draft.dimension.end} color="#2563eb" /> : null}
            {draft.room ? <DraftRoom start={draft.room.start} end={draft.room.end} /> : null}
            {draft.wall ? <DraftWall start={draft.wall.start} end={draft.wall.end} thickness={settings?.defaultWallThickness ?? 0.15} /> : null}
            {draft.hover ? <WallHoverMarker point={draft.hover} kind={tool === "door" ? "door" : "window"} /> : null}
          </Layer>
        </Stage>
      ) : null}
      {/* Graphic scale, bottom left. */}
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-md bg-[#0f1a33]/85 px-3 py-2 text-[10px] text-white/80 shadow-lg backdrop-blur">
        <div className="relative h-3" style={{ width: scaleBarMeters * scale }}>
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} className="absolute top-0 h-2 w-px bg-white/80" style={{ left: (index / 5) * scaleBarMeters * scale }} />
          ))}
          <span className="absolute top-2 left-0 h-px w-full bg-white/80" />
        </div>
        <div className="relative mt-0.5 h-3" style={{ width: scaleBarMeters * scale }}>
          {[0, 1, 2, 3, 5].map((step) => (
            <span key={step} className="absolute -translate-x-1/2 tabular-nums" style={{ left: (step / 5) * scaleBarMeters * scale }}>
              {(step * scaleBarMeters) / 5}
              {step === 5 ? " m" : ""}
            </span>
          ))}
        </div>
      </div>
      {/* Zoom and grid controls, bottom right. */}
      <div className="absolute right-4 bottom-4 flex items-center gap-1 rounded-lg border border-white/10 bg-[#0f1a33]/90 p-1 text-white shadow-lg backdrop-blur">
        <button type="button" onClick={() => zoomBy(1.25)} className="flex size-7 items-center justify-center rounded-md hover:bg-white/10" aria-label="Zoom avant">
          <Plus className="size-4" />
        </button>
        <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => zoomBy(1 / 1.25)} className="flex size-7 items-center justify-center rounded-md hover:bg-white/10" aria-label="Zoom arrière">
          <Minus className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-white/15" />
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-white/10">
          <input type="checkbox" checked={showGrid} onChange={showGridToggle} className="size-3.5 accent-[#2563eb]" />
          Grille
        </label>
      </div>
    </div>
  );
};
