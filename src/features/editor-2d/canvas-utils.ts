import type { Vec2 } from "@/domain/plan/schema";
import { snapToGrid } from "@/domain/plan/geometry";

/** Rounds a plan point to the editor grid. */
export const snapPoint = (point: Vec2, step: number): Vec2 => ({
  x: snapToGrid(point.x, step),
  y: snapToGrid(point.y, step),
});

/** Locks a segment to the horizontal or vertical axis when it is almost aligned. */
export const alignToAxis = (start: Vec2, end: Vec2, toleranceDegrees = 7): Vec2 => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
  const nearHorizontal = angle < toleranceDegrees || angle > 180 - toleranceDegrees;
  const nearVertical = Math.abs(angle - 90) < toleranceDegrees;
  if (nearHorizontal) return { x: end.x, y: start.y };
  if (nearVertical) return { x: start.x, y: end.y };
  return end;
};

export const SELECTION_COLOR = "#2563eb";
export const WALL_COLOR = "#232a36";
export const LABEL_COLOR = "#1e293b";
export const LABEL_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
