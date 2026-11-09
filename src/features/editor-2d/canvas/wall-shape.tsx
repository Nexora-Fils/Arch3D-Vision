"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import { Circle, Group, Line } from "react-konva";
import { snapToGrid } from "@/domain/plan/geometry";
import type { Vec2, Wall } from "@/domain/plan/schema";
import { SELECTION_COLOR, snapPointToWalls, WALL_COLOR } from "@/features/editor-2d/canvas-utils";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

interface WallShapeProps {
  wall: Wall;
  floorId: string;
  gridStep: number;
  isSelected: boolean;
  isInteractive: boolean;
  snapWalls?: Wall[];
  snapTolerance?: number;
}

export const WallShape = ({ wall, floorId, gridStep, isSelected, isInteractive, snapWalls, snapTolerance = 0.2 }: WallShapeProps) => {
  const { updateWall, commit } = usePlanStore.getState();
  const { select } = useEditorStore.getState();
  const isFreeWall = wall.roomId === null;

  const handleSelect = (event: KonvaEventObject<Event>) => {
    event.cancelBubble = true;
    select({ kind: "wall", id: wall.id });
  };

  const handleEndpointDrag = (key: "start" | "end") => (event: KonvaEventObject<DragEvent>) => {
    const node = event.target;
    const gridPoint: Vec2 = { x: snapToGrid(node.x(), gridStep), y: snapToGrid(node.y(), gridStep) };
    const point = snapWalls?.length ? snapPointToWalls(gridPoint, snapWalls, snapTolerance) : gridPoint;
    node.position(point);
    updateWall(floorId, wall.id, { [key]: point }, { transient: true });
  };

  return (
    <Group>
      <Line
        points={[wall.start.x, wall.start.y, wall.end.x, wall.end.y]}
        stroke={isSelected ? SELECTION_COLOR : WALL_COLOR}
        strokeWidth={wall.thickness}
        hitStrokeWidth={Math.max(wall.thickness, 0.35)}
        lineCap="butt"
        listening={isInteractive}
        onClick={handleSelect}
        onTap={handleSelect}
      />
      {isSelected && isFreeWall
        ? (["start", "end"] as const).map((key) => (
            <Circle
              key={key}
              x={wall[key].x}
              y={wall[key].y}
              radius={0.14}
              fill="#ffffff"
              stroke={SELECTION_COLOR}
              strokeWidth={2}
              strokeScaleEnabled={false}
              draggable
              onDragMove={handleEndpointDrag(key)}
              onDragEnd={commit}
            />
          ))
        : null}
    </Group>
  );
};
