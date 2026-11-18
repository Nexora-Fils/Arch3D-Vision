import type { Door, DoorType, Floor, Room, Vec2, Wall } from "./schema";
import {
  angleOf,
  clamp,
  EPSILON,
  isOutdoorRoom,
  isPointInRoom,
  pointAlongWall,
  projectOnSegment,
  vecAdd,
  vecDot,
  vecLength,
  vecPerp,
  vecScale,
  vecSub,
  wallDirection,
  wallLength,
  type Segment,
} from "./geometry";

/** Two walls closer than this (m) are considered collinear and merged. */
const COLLINEAR_TOLERANCE = 0.02;
const ANGLE_TOLERANCE = 1e-3;

// ---------------------------------------------------------------------------
// Merged wall segments (shared by the 3D renderer and the collision system)
// ---------------------------------------------------------------------------

export interface WallOpening {
  id: string;
  kind: "door" | "window";
  /** Distance from the merged segment start to the opening center (m). */
  offset: number;
  width: number;
  height: number;
  sillHeight: number;
  doorType: DoorType | null;
  swing: Door["swing"] | null;
}

export interface WallSegment {
  id: string;
  start: Vec2;
  end: Vec2;
  direction: Vec2;
  normal: Vec2;
  length: number;
  thickness: number;
  height: number;
  materialId: string | null;
  sourceWallIds: string[];
  openings: WallOpening[];
  /** +1: exterior on the +normal side, -1: on the -normal side, 0: interior or free wall. */
  exteriorSide: 1 | -1 | 0;
}

interface LineGroup {
  direction: Vec2;
  normal: Vec2;
  /** Point of the line at t = 0. */
  origin: Vec2;
  perp: number;
  walls: { wall: Wall; t1: number; t2: number }[];
}

const canonicalDirection = (direction: Vec2): Vec2 => {
  if (direction.x < -EPSILON || (Math.abs(direction.x) <= EPSILON && direction.y < 0)) {
    return vecScale(direction, -1);
  }
  return direction;
};

const groupCollinearWalls = (walls: Wall[]): LineGroup[] => {
  const groups: LineGroup[] = [];
  for (const wall of walls) {
    if (wallLength(wall) < EPSILON) continue;
    const direction = canonicalDirection(wallDirection(wall));
    const normal = vecPerp(direction);
    const perp = vecDot(wall.start, normal);
    let group = groups.find(
      (candidate) =>
        Math.abs(angleOf(candidate.direction) - angleOf(direction)) < ANGLE_TOLERANCE &&
        Math.abs(candidate.perp - perp) < COLLINEAR_TOLERANCE,
    );
    if (!group) {
      group = {
        direction,
        normal,
        origin: vecScale(normal, perp),
        perp,
        walls: [],
      };
      groups.push(group);
    }
    const tStart = vecDot(wall.start, direction);
    const tEnd = vecDot(wall.end, direction);
    group.walls.push({ wall, t1: Math.min(tStart, tEnd), t2: Math.max(tStart, tEnd) });
  }
  return groups;
};

const detectExteriorSide = (
  segment: Pick<WallSegment, "start" | "end" | "normal" | "thickness">,
  rooms: Room[],
): 1 | -1 | 0 => {
  const middle = vecScale(vecAdd(segment.start, segment.end), 0.5);
  const probeDistance = segment.thickness / 2 + 0.1;
  const positive = vecAdd(middle, vecScale(segment.normal, probeDistance));
  const negative = vecAdd(middle, vecScale(segment.normal, -probeDistance));
  const indoor = rooms.filter((room) => !isOutdoorRoom(room));
  const positiveInside = indoor.some((room) => isPointInRoom(room, positive));
  const negativeInside = indoor.some((room) => isPointInRoom(room, negative));
  if (positiveInside && !negativeInside) return -1;
  if (negativeInside && !positiveInside) return 1;
  return 0;
};

const openingsOverlap = (a: WallOpening, b: WallOpening): boolean =>
  Math.abs(a.offset - b.offset) < (a.width + b.width) / 2 - EPSILON;

/**
 * Merges overlapping collinear walls (a wall shared by two rooms) into single
 * segments and attaches the floor's doors and windows to them. Walls that only
 * touch end to end stay separate so each keeps its own material. The result is
 * what the 3D engine extrudes and what the walkthrough collides against, so two
 * rooms sharing a wall never produce overlapping geometry.
 */
export const buildWallSegments = (floor: Floor): WallSegment[] => {
  const wallsById = new Map(floor.walls.map((wall) => [wall.id, wall]));
  const groups = groupCollinearWalls(floor.walls);
  const segments: WallSegment[] = [];

  for (const group of groups) {
    const sorted = [...group.walls].sort((a, b) => a.t1 - b.t1);
    let current: { t1: number; t2: number; walls: Wall[] } | null = null;
    const merged: { t1: number; t2: number; walls: Wall[] }[] = [];
    for (const item of sorted) {
      if (current && item.t1 < current.t2 - EPSILON) {
        current.t2 = Math.max(current.t2, item.t2);
        current.walls.push(item.wall);
      } else {
        current = { t1: item.t1, t2: item.t2, walls: [item.wall] };
        merged.push(current);
      }
    }
    for (const part of merged) {
      const start = vecAdd(group.origin, vecScale(group.direction, part.t1));
      const end = vecAdd(group.origin, vecScale(group.direction, part.t2));
      const thickness = Math.max(...part.walls.map((wall) => wall.thickness));
      const segment: WallSegment = {
        id: part.walls
          .map((wall) => wall.id)
          .sort()
          .join("+"),
        start,
        end,
        direction: group.direction,
        normal: group.normal,
        length: part.t2 - part.t1,
        thickness,
        height: Math.max(...part.walls.map((wall) => wall.height)),
        materialId: part.walls.find((wall) => wall.materialId)?.materialId ?? null,
        sourceWallIds: part.walls.map((wall) => wall.id),
        openings: [],
        exteriorSide: detectExteriorSide({ start, end, normal: group.normal, thickness }, floor.rooms),
      };
      segments.push(segment);
    }
  }

  const attach = (opening: WallOpening, wallId: string) => {
    const wall = wallsById.get(wallId);
    if (!wall) return;
    const segment = segments.find((candidate) => candidate.sourceWallIds.includes(wallId));
    if (!segment) return;
    const center = pointAlongWall(wall, opening.offset);
    const t = vecDot(vecSub(center, segment.start), segment.direction);
    if (opening.width >= segment.length) return;
    const offset = clamp(t, opening.width / 2, segment.length - opening.width / 2);
    const placed = { ...opening, offset };
    if (segment.openings.some((existing) => openingsOverlap(existing, placed))) return;
    segment.openings.push(placed);
  };

  for (const door of floor.doors) {
    attach(
      {
        id: door.id,
        kind: "door",
        offset: door.offset,
        width: door.width,
        height: door.height,
        sillHeight: 0,
        doorType: door.type,
        swing: door.swing,
      },
      door.wallId,
    );
  }
  for (const window of floor.windows) {
    attach(
      {
        id: window.id,
        kind: "window",
        offset: window.offset,
        width: window.width,
        height: window.height,
        sillHeight: window.sillHeight,
        doorType: null,
        swing: null,
      },
      window.wallId,
    );
  }
  for (const segment of segments) {
    segment.openings.sort((a, b) => a.offset - b.offset);
  }
  return segments;
};

// ---------------------------------------------------------------------------
// Collisions (walkthrough)
// ---------------------------------------------------------------------------

export interface SolidSegment extends Segment {
  halfThickness: number;
}

/** Wall pieces that block the visitor: everything except door openings. */
export const buildSolidSegments = (segments: WallSegment[]): SolidSegment[] => {
  const solids: SolidSegment[] = [];
  for (const segment of segments) {
    const doors = segment.openings.filter((opening) => opening.kind === "door").sort((a, b) => a.offset - b.offset);
    let cursor = 0;
    const pushPiece = (from: number, to: number) => {
      if (to - from < EPSILON) return;
      solids.push({
        start: vecAdd(segment.start, vecScale(segment.direction, from)),
        end: vecAdd(segment.start, vecScale(segment.direction, to)),
        halfThickness: segment.thickness / 2,
      });
    };
    for (const door of doors) {
      pushPiece(cursor, door.offset - door.width / 2);
      cursor = door.offset + door.width / 2;
    }
    pushPiece(cursor, segment.length);
  }
  return solids;
};

/**
 * Pushes a circle of the given radius out of every solid wall piece. Several
 * passes let the visitor slide along walls and through corners.
 */
export const resolveCollisions = (position: Vec2, solids: SolidSegment[], radius: number, passes = 3): Vec2 => {
  let resolved = position;
  for (let pass = 0; pass < passes; pass += 1) {
    for (const solid of solids) {
      const { offset } = projectOnSegment(solid, resolved);
      const closest = pointAlongWall(solid, offset);
      const delta = vecSub(resolved, closest);
      const distance = vecLength(delta);
      const minDistance = radius + solid.halfThickness;
      if (distance >= minDistance) continue;
      const pushDirection = distance < EPSILON ? vecPerp(wallDirection(solid)) : vecScale(delta, 1 / distance);
      resolved = vecAdd(resolved, vecScale(pushDirection, minDistance - distance));
    }
  }
  return resolved;
};
