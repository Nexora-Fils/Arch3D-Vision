"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import type { Vector2d } from "konva/lib/types";
import { Arc, Group, Line, Rect } from "react-konva";
import { clampOpeningOffset, openingPlacement, vecDot, vecSub, wallDirection } from "@/domain/plan/geometry";
import type { Door, Wall, Window } from "@/domain/plan/schema";
import { SELECTION_COLOR } from "@/features/editor-2d/canvas-utils";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

interface OpeningGroupProps {
  wall: Wall;
  width: number;
  offset: number;
  isSelected: boolean;
  isInteractive: boolean;
  onSelect: () => void;
  onOffsetChange: (offset: number) => void;
  onCommit: () => void;
  children: React.ReactNode;
}

/** Positions an opening on its wall and constrains dragging along the wall. */
const OpeningGroup = ({ wall, width, offset, isSelected, isInteractive, onSelect, onOffsetChange, onCommit, children }: OpeningGroupProps) => {
  const { center, angle } = openingPlacement(wall, { offset, width });
  const direction = wallDirection(wall);

  const handleSelect = (event: KonvaEventObject<Event>) => {
    event.cancelBubble = true;
    onSelect();
  };

  const dragBoundFunc = function (this: { getStage: () => { x: () => number; y: () => number; scaleX: () => number } | null }, position: Vector2d) {
    const stage = this.getStage();
    if (!stage) return position;
    const scale = stage.scaleX();
    const point = { x: (position.x - stage.x()) / scale, y: (position.y - stage.y()) / scale };
    const nextOffset = clampOpeningOffset(wall, width, vecDot(vecSub(point, wall.start), direction));
    const snapped = { x: wall.start.x + direction.x * nextOffset, y: wall.start.y + direction.y * nextOffset };
    return { x: snapped.x * scale + stage.x(), y: snapped.y * scale + stage.y() };
  };

  const handleDragMove = (event: KonvaEventObject<DragEvent>) => {
    const node = event.target;
    const nextOffset = clampOpeningOffset(wall, width, vecDot(vecSub({ x: node.x(), y: node.y() }, wall.start), direction));
    onOffsetChange(Math.round(nextOffset * 100) / 100);
  };

  return (
    <Group
      x={center.x}
      y={center.y}
      rotation={(angle * 180) / Math.PI}
      listening={isInteractive}
      draggable={isInteractive}
      dragBoundFunc={dragBoundFunc}
      onClick={handleSelect}
      onTap={handleSelect}
      onDragStart={handleSelect}
      onDragMove={handleDragMove}
      onDragEnd={onCommit}
    >
      {children}
      {isSelected ? (
        <Rect x={-width / 2 - 0.08} y={-wall.thickness / 2 - 0.08} width={width + 0.16} height={wall.thickness + 0.16} stroke={SELECTION_COLOR} strokeWidth={2} strokeScaleEnabled={false} listening={false} />
      ) : null}
    </Group>
  );
};

interface DoorShapeProps {
  door: Door;
  wall: Wall;
  floorId: string;
  isSelected: boolean;
  isInteractive: boolean;
}

export const DoorShape = ({ door, wall, floorId, isSelected, isInteractive }: DoorShapeProps) => {
  const { updateDoor, commit } = usePlanStore.getState();
  const { select } = useEditorStore.getState();
  const hingeX = door.swing === "left" ? -door.width / 2 : door.width / 2;
  const thickness = wall.thickness;
  return (
    <OpeningGroup
      wall={wall}
      width={door.width}
      offset={door.offset}
      isSelected={isSelected}
      isInteractive={isInteractive}
      onSelect={() => select({ kind: "door", id: door.id })}
      onOffsetChange={(offset) => updateDoor(floorId, door.id, { offset }, { transient: true })}
      onCommit={commit}
    >
      <Rect x={-door.width / 2} y={-thickness / 2 - 0.01} width={door.width} height={thickness + 0.02} fill="#ffffff" />
      {door.type === "standard" ? (
        <>
          <Arc x={hingeX} y={-thickness / 2} innerRadius={0} outerRadius={door.width} angle={90} rotation={door.swing === "left" ? -90 : 180} stroke="#64748b" strokeWidth={1} strokeScaleEnabled={false} dash={[0.08, 0.06]} />
          <Line points={[hingeX, -thickness / 2, hingeX, -thickness / 2 - door.width]} stroke="#1e293b" strokeWidth={0.04} />
        </>
      ) : door.type === "sliding" ? (
        <>
          <Line points={[-door.width / 2, -thickness / 4, 0, -thickness / 4]} stroke="#1d4ed8" strokeWidth={0.05} />
          <Line points={[-door.width / 10, thickness / 4, door.width / 2, thickness / 4]} stroke="#1d4ed8" strokeWidth={0.05} />
          <Line points={[-door.width / 2, 0, door.width / 2, 0]} stroke="#93c5fd" strokeWidth={1} strokeScaleEnabled={false} />
        </>
      ) : (
        <Line points={[-door.width / 2, 0, door.width / 2, 0]} stroke="#94a3b8" strokeWidth={1} strokeScaleEnabled={false} dash={[0.15, 0.1]} />
      )}
    </OpeningGroup>
  );
};

interface WindowShapeProps {
  window: Window;
  wall: Wall;
  floorId: string;
  isSelected: boolean;
  isInteractive: boolean;
}

export const WindowShape = ({ window, wall, floorId, isSelected, isInteractive }: WindowShapeProps) => {
  const { updateWindow, commit } = usePlanStore.getState();
  const { select } = useEditorStore.getState();
  const thickness = wall.thickness;
  return (
    <OpeningGroup
      wall={wall}
      width={window.width}
      offset={window.offset}
      isSelected={isSelected}
      isInteractive={isInteractive}
      onSelect={() => select({ kind: "window", id: window.id })}
      onOffsetChange={(offset) => updateWindow(floorId, window.id, { offset }, { transient: true })}
      onCommit={commit}
    >
      <Rect x={-window.width / 2} y={-thickness / 2 - 0.01} width={window.width} height={thickness + 0.02} fill="#dbeafe" stroke="#1d4ed8" strokeWidth={1} strokeScaleEnabled={false} />
      <Line points={[-window.width / 2, 0, window.width / 2, 0]} stroke="#1d4ed8" strokeWidth={1} strokeScaleEnabled={false} />
    </OpeningGroup>
  );
};
