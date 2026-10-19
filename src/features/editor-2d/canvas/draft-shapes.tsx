"use client";

import { Circle, Line, Rect, Text } from "react-konva";
import { formatMeters } from "@/domain/plan/geometry";
import type { Vec2 } from "@/domain/plan/schema";
import { SELECTION_COLOR } from "@/features/editor-2d/canvas-utils";

export const DraftRoom = ({ start, end }: { start: Vec2; end: Vec2 }) => {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const depth = Math.abs(end.y - start.y);
  return (
    <>
      <Rect x={x} y={y} width={width} height={depth} fill="rgba(37, 99, 235, 0.12)" stroke={SELECTION_COLOR} strokeWidth={1.5} strokeScaleEnabled={false} dash={[6, 4]} listening={false} />
      <Text x={x} y={y - 0.4} text={`${formatMeters(width)} × ${formatMeters(depth)}`} fontSize={0.28} fill={SELECTION_COLOR} listening={false} />
    </>
  );
};

export const DraftWall = ({ start, end, thickness }: { start: Vec2; end: Vec2 | null; thickness: number }) => (
  <>
    <Circle x={start.x} y={start.y} radius={0.12} fill={SELECTION_COLOR} listening={false} />
    {end ? (
      <>
        <Line points={[start.x, start.y, end.x, end.y]} stroke="rgba(37, 99, 235, 0.6)" strokeWidth={thickness} listening={false} />
        <Text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 0.4} text={formatMeters(Math.hypot(end.x - start.x, end.y - start.y))} fontSize={0.28} fill={SELECTION_COLOR} listening={false} />
      </>
    ) : null}
  </>
);

export const WallHoverMarker = ({ point, kind }: { point: Vec2; kind: "door" | "window" }) => (
  <Circle x={point.x} y={point.y} radius={0.16} fill={kind === "door" ? "rgba(37, 99, 235, 0.35)" : "rgba(29, 78, 216, 0.35)"} stroke={SELECTION_COLOR} strokeWidth={1.5} strokeScaleEnabled={false} listening={false} />
);
