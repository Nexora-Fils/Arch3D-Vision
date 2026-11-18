"use client";

import type { Stage as KonvaStage } from "konva/lib/Stage";
import { useEffect, useMemo, useRef } from "react";
import { Layer, Stage } from "react-konva";
import { toast } from "sonner";
import { floorBelow, indoorBounds } from "@/domain/plan/geometry";
import { ROOM_TYPE_LABELS } from "@/domain/plan/labels";
import type { Floor } from "@/domain/plan/schema";
import { buildStairFlights, isStairs } from "@/domain/plan/stairs";
import { stairIssues } from "@/domain/plan/stair-checks";
import { AnnotationShape, DimensionLine } from "@/features/editor-2d/canvas/annotation-shape";
import { StairwellOutline } from "@/features/editor-2d/canvas/stairwell-outline";
import { DraftRoom, DraftWall, WallHoverMarker } from "@/features/editor-2d/canvas/draft-shapes";
import { FurnitureShape } from "@/features/editor-2d/canvas/furniture-shape";
import { GridLayer } from "@/features/editor-2d/canvas/grid-layer";
import { HouseDimensions } from "@/features/editor-2d/canvas/house-dimensions";
import { LowerFloorUnderlay } from "@/features/editor-2d/canvas/lower-floor-underlay";
import { DoorShape, WindowShape } from "@/features/editor-2d/canvas/opening-shape";
import { RoomLabel, RoomShape } from "@/features/editor-2d/canvas/room-shape";
import { WallShape } from "@/features/editor-2d/canvas/wall-shape";
import { ScaleBar, ZoomControls } from "@/features/editor-2d/canvas-overlays";
import { useCanvasViewport } from "@/features/editor-2d/use-canvas-viewport";
import { useDrawingTools } from "@/features/editor-2d/use-drawing-tools";
import { patternScaleFor, usePlanImages } from "@/features/editor-2d/use-plan-images";
import { photoForMaterial } from "@/features/viewer-3d/textures";
import { EXPORT_PLAN_EVENT } from "@/features/project/project-top-bar";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

interface EditorCanvasProps {
  floor: Floor;
}

export const EditorCanvas = ({ floor }: EditorCanvasProps) => {
  const stageRef = useRef<KonvaStage>(null);

  const tool = useEditorStore((state) => state.tool);
  const gridStep = useEditorStore((state) => state.gridStep);
  const showGrid = useEditorStore((state) => state.showGrid);
  const showDimensions = useEditorStore((state) => state.showDimensions);
  const showLowerFloor = useEditorStore((state) => state.showLowerFloor);
  const selection = useEditorStore((state) => state.selection);
  const lot = usePlanStore((state) => state.plan?.lot ?? { width: 20, depth: 15 });
  const materials = usePlanStore((state) => state.plan?.materials ?? []);
  const settings = usePlanStore((state) => state.plan?.settings);
  const plan = usePlanStore((state) => state.plan);
  const lowerFloor = useMemo(() => (plan ? floorBelow(plan.floors, floor.level) : null), [floor.level, plan]);
  // Stairwells cut in this floor by the flights coming from the level below, and stairs that lead nowhere.
  const stairwells = useMemo(() => {
    if (!plan) return [];
    const index = plan.floors.findIndex((candidate) => candidate.id === floor.id);
    return buildStairFlights(plan).filter((flight) => flight.upperIndex === index);
  }, [plan, floor.id]);
  const issues = useMemo(() => (plan ? stairIssues(plan) : new Map<string, string[]>()), [plan]);

  const images = usePlanImages();
  const { containerRef, size, pan, scale, isSpaceHeld, handleWheel, handleTouchMove, handleTouchEnd, handleDragEnd } =
    useCanvasViewport(stageRef, lot);
  const snapTolerance = Math.min(0.25, Math.max(gridStep / 2, 10 / scale));
  const isPanning = tool === "pan" || isSpaceHeld;
  const { draft, handlePointerDown, handlePointerMove, handlePointerUp, handleContextMenu } = useDrawingTools({
    stageRef,
    floor,
    lowerFloor,
    snapTolerance,
    isPanning,
  });

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

  const cursor = isPanning ? "grab" : tool === "select" ? "default" : "crosshair";
  const floorColorFor = (materialId: string | null) => materials.find((material) => material.id === materialId)?.color;
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
  const houseBounds = indoorBounds(floor);

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
            <GridLayer
              lot={lot}
              scale={scale}
              showGrid={showGrid}
              viewport={{ pan, size }}
              grassImage={images.grass ?? null}
            />
          </Layer>
          <Layer>
            {showLowerFloor && lowerFloor ? (
              <LowerFloorUnderlay
                lowerFloor={lowerFloor}
                gridStep={gridStep}
                showDimensions={showDimensions}
                floorColorFor={floorColorFor}
                floorPatternFor={floorPatternFor}
              />
            ) : null}
            {floor.rooms.map((room) => (
              <RoomShape
                key={room.id}
                room={room}
                floorId={floor.id}
                gridStep={gridStep}
                isSelected={selection?.kind === "room" && selection.id === room.id}
                isInteractive={tool === "select"}
                showDimensions={showDimensions}
                floorColor={floorColorFor(room.floorMaterialId)}
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
                snapWalls={showLowerFloor ? lowerFloor?.walls : undefined}
                snapTolerance={snapTolerance}
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
              <RoomLabel
                key={`label-${room.id}`}
                room={room}
                showDimensions={showDimensions}
                typeLabel={ROOM_TYPE_LABELS[room.type]}
              />
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
            {showDimensions && houseBounds ? <HouseDimensions bounds={houseBounds} /> : null}
            {draft.dimension?.end ? (
              <DimensionLine start={draft.dimension.start} end={draft.dimension.end} color="#2563eb" />
            ) : null}
            {draft.room ? <DraftRoom start={draft.room.start} end={draft.room.end} /> : null}
            {draft.wall ? (
              <DraftWall
                start={draft.wall.start}
                end={draft.wall.end}
                thickness={settings?.defaultWallThickness ?? 0.15}
              />
            ) : null}
            {draft.hover ? <WallHoverMarker point={draft.hover} kind={tool === "door" ? "door" : "window"} /> : null}
          </Layer>
        </Stage>
      ) : null}
      <ScaleBar scale={scale} />
      <ZoomControls />
    </div>
  );
};
