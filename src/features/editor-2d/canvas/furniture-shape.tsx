"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import { Group, Rect, Text } from "react-konva";
import { snapToGrid } from "@/domain/plan/geometry";
import { FURNITURE_TYPE_LABELS } from "@/domain/plan/labels";
import type { Furniture } from "@/domain/plan/schema";
import { isStairs } from "@/domain/plan/stairs";
import { StairSymbol } from "@/features/editor-2d/canvas/stair-symbol";
import { SELECTION_COLOR } from "@/features/editor-2d/canvas-utils";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

interface FurnitureShapeProps {
  item: Furniture;
  /** Stairs only: the flight does not lead properly to the level above. */
  hasIssue?: boolean;
  floorId: string;
  gridStep: number;
  isSelected: boolean;
  isInteractive: boolean;
}

export const FurnitureShape = ({ item, floorId, gridStep, isSelected, isInteractive, hasIssue = false }: FurnitureShapeProps) => {
  const { updateFurniture, commit } = usePlanStore.getState();
  const { select } = useEditorStore.getState();

  const handleSelect = (event: KonvaEventObject<Event>) => {
    event.cancelBubble = true;
    select({ kind: "furniture", id: item.id });
  };

  const handleDragMove = (event: KonvaEventObject<DragEvent>) => {
    const node = event.target;
    const x = snapToGrid(node.x(), gridStep);
    const y = snapToGrid(node.y(), gridStep);
    node.position({ x, y });
    updateFurniture(floorId, item.id, { x, y }, { transient: true });
  };

  const label = FURNITURE_TYPE_LABELS[item.type];
  const stairType = isStairs(item.type) ? item.type : null;
  return (
    <Group
      x={item.x}
      y={item.y}
      rotation={item.rotation}
      listening={isInteractive}
      draggable={isInteractive}
      onClick={handleSelect}
      onTap={handleSelect}
      onDragStart={handleSelect}
      onDragMove={handleDragMove}
      onDragEnd={commit}
    >
      <Rect
        x={-item.width / 2}
        y={-item.depth / 2}
        width={item.width}
        height={item.depth}
        // Stairs: the box only catches clicks (and shows the selection); the symbol draws the model.
        fill={stairType ? "rgba(248, 250, 252, 0.01)" : item.color}
        opacity={stairType ? 1 : 0.7}
        cornerRadius={0.06}
        stroke={isSelected ? SELECTION_COLOR : stairType ? undefined : "rgba(30, 41, 59, 0.45)"}
        strokeWidth={isSelected ? 2.5 : 1}
        strokeScaleEnabled={false}
      />
      {stairType ? (
        <StairSymbol item={{ ...item, type: stairType }} hasIssue={hasIssue} />
      ) : item.width > 0.9 && item.depth > 0.5 ? (
        <Text x={-item.width / 2} y={-0.09} width={item.width} align="center" text={label} fontSize={0.16} fill="#1e293b" opacity={0.65} listening={false} />
      ) : null}
    </Group>
  );
};
