import { projectOnSegment, snapToGrid } from "@/domain/plan/geometry";
import type { Vec2, Wall } from "@/domain/plan/schema";

/** Rounds a plan point to the editor grid. */
export const snapPoint = (point: Vec2, step: number): Vec2 => ({
  x: snapToGrid(point.x, step),
  y: snapToGrid(point.y, step),
});

/** Snaps a point to the nearest wall segment when it is within the given tolerance. */
export const snapPointToWalls = (point: Vec2, walls: Wall[], tolerance: number): Vec2 => {
  let closest: { point: Vec2; distance: number } | null = null;
  for (const wall of walls) {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const { offset, distance } = projectOnSegment(wall, point);
    if (distance <= tolerance && (!closest || distance < closest.distance)) {
      const ratio = offset / length;
      closest = {
        point: {
          x: wall.start.x + dx * ratio,
          y: wall.start.y + dy * ratio,
        },
        distance,
      };
    }
  }
  return closest?.point ?? point;
};

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

/** Keeps a wall endpoint snapped to the lower floor after applying axis alignment. */
export const alignAndSnapWallEndpoint = (start: Vec2, end: Vec2, walls: Wall[], tolerance: number): Vec2 =>
  snapPointToWalls(alignToAxis(start, end), walls, tolerance);

export const SELECTION_COLOR = "#2563eb";
export const WALL_COLOR = "#232a36";
export const LABEL_COLOR = "#1e293b";
export const LABEL_FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";
