"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import { Group, Line, Rect, Text } from "react-konva";
import { snapToGrid, vecLength, vecSub } from "@/domain/plan/geometry";
import type { Annotation, Vec2 } from "@/domain/plan/schema";
import { LABEL_FONT, SELECTION_COLOR } from "@/features/editor-2d/canvas-utils";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

const DIMENSION_COLOR = "#334155";
const TICK = 0.18;

/** Length shown by a dimension line, formatted like the mockup ("12.00 m"). */
export const formatDimension = (start: Vec2, end: Vec2): string => `${vecLength(vecSub(end, start)).toFixed(2)} m`;

interface DimensionLineProps {
  start: Vec2;
  end: Vec2;
  color?: string;
  label?: string;
}

/** Architectural dimension line: extension ticks at both ends and the length centered above. */
export const DimensionLine = ({ start, end, color = DIMENSION_COLOR, label }: DimensionLineProps) => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const length = vecLength(vecSub(end, start));
  const text = label ?? formatDimension(start, end);
  const isVertical = Math.abs(Math.sin(angle)) > 0.7;
  return (
    <Group x={start.x} y={start.y} rotation={(angle * 180) / Math.PI} listening={false}>
      <Line points={[0, 0, length, 0]} stroke={color} strokeWidth={1.2} strokeScaleEnabled={false} />
      <Line points={[0, -TICK, 0, TICK]} stroke={color} strokeWidth={1.2} strokeScaleEnabled={false} />
      <Line points={[length, -TICK, length, TICK]} stroke={color} strokeWidth={1.2} strokeScaleEnabled={false} />
      <Line points={[-0.08, 0.08, 0.08, -0.08]} stroke={color} strokeWidth={1.6} strokeScaleEnabled={false} />
      <Line points={[length - 0.08, 0.08, length + 0.08, -0.08]} stroke={color} strokeWidth={1.6} strokeScaleEnabled={false} />
      <Text
        x={length / 2}
        y={isVertical ? 0.12 : -0.42}
        offsetX={length / 2}
        width={length}
        align="center"
        text={text}
        fontSize={0.28}
        fontFamily={LABEL_FONT}
        fill={color}
        fontStyle="600"
        rotation={isVertical && angle < 0 ? 180 : 0}
      />
    </Group>
  );
};

interface AnnotationShapeProps {
  annotation: Annotation;
  floorId: string;
  gridStep: number;
  isSelected: boolean;
  isInteractive: boolean;
}

export const AnnotationShape = ({ annotation, floorId, gridStep, isSelected, isInteractive }: AnnotationShapeProps) => {
  const { updateAnnotation, commit } = usePlanStore.getState();
  const { select } = useEditorStore.getState();
  const handleSelect = (event: KonvaEventObject<Event>) => {
    event.cancelBubble = true;
    select({ kind: "annotation", id: annotation.id });
  };
  const handleDragEnd = (event: KonvaEventObject<DragEvent>) => {
    const node = event.target;
    const delta = { x: snapToGrid(node.x(), gridStep), y: snapToGrid(node.y(), gridStep) };
    node.position({ x: 0, y: 0 });
    updateAnnotation(floorId, annotation.id, {
      start: { x: annotation.start.x + delta.x, y: annotation.start.y + delta.y },
      end: { x: annotation.end.x + delta.x, y: annotation.end.y + delta.y },
    });
    commit();
  };
  const color = isSelected ? SELECTION_COLOR : DIMENSION_COLOR;
  if (annotation.kind === "text") {
    const fontSize = 0.34;
    const width = Math.max(0.6, annotation.text.length * fontSize * 0.55);
    return (
      <Group listening={isInteractive} draggable={isInteractive} onClick={handleSelect} onTap={handleSelect} onDragStart={handleSelect} onDragEnd={handleDragEnd}>
        <Rect x={annotation.start.x - 0.08} y={annotation.start.y - 0.08} width={width + 0.16} height={fontSize + 0.16} fill={isSelected ? "rgba(37,99,235,0.08)" : "transparent"} stroke={isSelected ? SELECTION_COLOR : undefined} strokeWidth={1} strokeScaleEnabled={false} cornerRadius={0.05} />
        <Text x={annotation.start.x} y={annotation.start.y} text={annotation.text || " "} fontSize={fontSize} fontFamily={LABEL_FONT} fill={color} fontStyle="600" />
      </Group>
    );
  }
  return (
    <Group listening={isInteractive} draggable={isInteractive} onClick={handleSelect} onTap={handleSelect} onDragStart={handleSelect} onDragEnd={handleDragEnd}>
      {/* Wide invisible hit area along the line. */}
      <Line points={[annotation.start.x, annotation.start.y, annotation.end.x, annotation.end.y]} stroke="transparent" strokeWidth={0.4} />
      <DimensionLine start={annotation.start} end={annotation.end} color={color} label={annotation.text || undefined} />
    </Group>
  );
};
