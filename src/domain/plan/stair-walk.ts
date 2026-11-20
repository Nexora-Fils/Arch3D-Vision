import { clamp, projectOnSegment, vecDot, vecSub } from "./geometry";
import type { Vec2 } from "./schema";
import type { StairEdge, StairPiece, StairShape } from "./stairs";
import type { SolidSegment } from "./wall-segments";

/** Thickness given to the virtual walls around a stair or a stairwell (m). */
const RAIL_HALF_THICKNESS = 0.03;
/** Tolerance when locating a point on the stair (m). */
const LOCATE_EPSILON = 0.02;

/** Position of a point in the frame of a piece: `t` from 0 (entry edge) to 1 (far edge), `v` across from its centerline. */
export const pieceCoordinates = (piece: StairPiece, point: Vec2): { t: number; v: number } => {
  const offset = vecSub(point, piece.start);
  return { t: vecDot(offset, piece.direction) / piece.length, v: vecDot(offset, piece.across) };
};

/** Height of the walking surface of a piece at `point` (clamped to the piece). */
export const pieceElevation = (piece: StairPiece, point: Vec2): number =>
  piece.kind === "landing"
    ? piece.fromHeight
    : piece.fromHeight + clamp(pieceCoordinates(piece, point).t, 0, 1) * (piece.toHeight - piece.fromHeight);

export type StairLocation =
  { kind: "piece"; index: number } | { kind: "below" } | { kind: "above" } | { kind: "outside" };

/**
 * Where a point stands relative to a stair: on one of its pieces, past the
 * entry edge (back on the lower floor), past the exit edge (on the upper
 * floor) or elsewhere.
 */
export const locateOnStair = (stair: StairShape, point: Vec2): StairLocation => {
  const index = stair.pieces.findIndex((piece) => {
    const { t, v } = pieceCoordinates(piece, point);
    const margin = LOCATE_EPSILON / piece.length;
    return t >= -margin && t <= 1 + margin && Math.abs(v) <= piece.width / 2 + LOCATE_EPSILON;
  });
  const first = pieceCoordinates(stair.pieces[0], point);
  const last = pieceCoordinates(stair.pieces[stair.pieces.length - 1], point);
  const lastPiece = stair.pieces[stair.pieces.length - 1];
  if (last.t > 1 && Math.abs(last.v) <= lastPiece.width / 2 + LOCATE_EPSILON) return { kind: "above" };
  if (first.t < 0 && Math.abs(first.v) <= stair.pieces[0].width / 2 + LOCATE_EPSILON) return { kind: "below" };
  return index >= 0 ? { kind: "piece", index } : { kind: "outside" };
};

/** Is the point on the stair's footprint (a piece or the well)? */
export const isOnStair = (stair: StairShape, point: Vec2): boolean =>
  stair.openings.some((bounds, index) => {
    if (index < stair.pieces.length) {
      const piece = stair.pieces[index];
      const { t, v } = pieceCoordinates(piece, point);
      return t >= 0 && t <= 1 && Math.abs(v) <= piece.width / 2;
    }
    return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
  });

/** Height of the walking surface at `point`, on the piece it stands on (or the nearest end). */
export const stairElevation = (stair: StairShape, point: Vec2, hint = 0): number => {
  const location = locateOnStair(stair, point);
  if (location.kind === "above") return stair.rise;
  if (location.kind === "below") return 0;
  const piece = stair.pieces[location.kind === "piece" ? location.index : clamp(hint, 0, stair.pieces.length - 1)];
  return pieceElevation(piece, point);
};

/** Height of a stair edge point (in the item frame), on the piece the edge belongs to. */
export const edgeElevation = (stair: StairShape, edge: StairEdge, point: Vec2): number => {
  if (edge.piece < 0) return 0;
  return pieceElevation(stair.pieces[edge.piece], point);
};

const solid = (edge: StairEdge): SolidSegment => ({
  start: edge.start,
  end: edge.end,
  halfThickness: RAIL_HALF_THICKNESS,
});

/** Rails around the walkable pieces, open at the entry and the exit. */
export const stairSideSolids = (stair: StairShape): SolidSegment[] =>
  stair.edges.filter((edge) => edge.role === "side").map(solid);

/** On the lower floor the stair can only be entered from its entry edge. */
export const lowerStairSolids = (stair: StairShape): SolidSegment[] =>
  stair.footprintEdges.filter((edge) => edge.role !== "entry").map(solid);

/** On the upper floor the stairwell is guarded on every side except the arrival. */
export const upperStairSolids = (stair: StairShape): SolidSegment[] =>
  stair.footprintEdges.filter((edge) => edge.role !== "exit").map(solid);

/** Distance from a point to the closest wall of a floor (used to decide where handrails are needed). */
export const distanceToWalls = (walls: SolidSegment[], point: Vec2): number =>
  walls.reduce((best, wall) => Math.min(best, projectOnSegment(wall, point).distance - wall.halfThickness), Infinity);
