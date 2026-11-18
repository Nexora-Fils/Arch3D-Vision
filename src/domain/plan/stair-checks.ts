import {
  isOutdoorRoom,
  isPointInRoom,
  LEVEL_SLAB_THICKNESS,
  openingPlacement,
  vecAdd,
  vecDot,
  vecNormalize,
  vecScale,
  vecSub,
  type Bounds,
} from "./geometry";
import type { Door, Floor, Furniture, Plan, Vec2, Wall } from "./schema";
import { buildStairShape, isStairs, type StairShape } from "./stairs";
import { buildSolidSegments, buildWallSegments, type SolidSegment } from "./wall-segments";

/** Inner margin so that walls touching the edge of a stair are not reported as crossing it (m). */
const EDGE_TOLERANCE = 0.05;
/** Shortest usable flight (m). */
const MIN_FLIGHT_LENGTH = 0.5;

interface Frame {
  start: Vec2;
  direction: Vec2;
  across: Vec2;
}

/**
 * Does a (thick) wall segment cross the area [from, to] × [-halfWidth, halfWidth]
 * of a frame? Liang–Barsky clipping, the area being grown by the wall's half thickness.
 */
const crossesArea = (frame: Frame, wall: SolidSegment, from: number, to: number, halfWidth: number): boolean => {
  const toLocal = (point: Vec2) => ({
    u: vecDot(vecSub(point, frame.start), frame.direction),
    v: vecDot(vecSub(point, frame.start), frame.across),
  });
  const start = toLocal(wall.start);
  const end = toLocal(wall.end);
  const grow = wall.halfThickness;
  const bounds = { minU: from - grow, maxU: to + grow, minV: -halfWidth - grow, maxV: halfWidth + grow };
  let t0 = 0;
  let t1 = 1;
  const du = end.u - start.u;
  const dv = end.v - start.v;
  const checks: [number, number][] = [
    [-du, start.u - bounds.minU],
    [du, bounds.maxU - start.u],
    [-dv, start.v - bounds.minV],
    [dv, bounds.maxV - start.v],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-12) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
};

/** Does a wall cut through one of the pieces (shrunk by a tolerance)? */
const crossesStair = (stair: StairShape, walls: SolidSegment[]): boolean =>
  stair.pieces.some((piece) =>
    walls.some((wall) =>
      crossesArea(piece, wall, EDGE_TOLERANCE, piece.length - EDGE_TOLERANCE, piece.width / 2 - EDGE_TOLERANCE),
    ),
  );

const floorSolids = (floor: Floor): SolidSegment[] => buildSolidSegments(buildWallSegments(floor));

const isInsideIndoorRoom = (floor: Floor, point: Vec2): boolean =>
  floor.rooms.some((room) => !isOutdoorRoom(room) && isPointInRoom(room, point));

const projectPolygon = (points: Vec2[], axis: Vec2): [number, number] => {
  let min = Infinity;
  let max = -Infinity;
  for (const point of points) {
    const projection = vecDot(point, axis);
    min = Math.min(min, projection);
    max = Math.max(max, projection);
  }
  return [min, max];
};

const polygonIntersectsBounds = (polygon: Vec2[], bounds: Bounds): boolean => {
  const rectangle = [
    { x: bounds.minX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.minY },
    { x: bounds.maxX, y: bounds.maxY },
    { x: bounds.minX, y: bounds.maxY },
  ];
  const axes = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const edge = vecSub(end, start);
    const length = Math.hypot(edge.x, edge.y);
    if (length > 1e-12) {
      axes.push(vecNormalize({ x: -edge.y, y: edge.x }));
    }
  }

  return axes.every((axis) => {
    const [polygonMin, polygonMax] = projectPolygon(polygon, axis);
    const [rectangleMin, rectangleMax] = projectPolygon(rectangle, axis);
    return polygonMax > rectangleMin + 1e-6 && rectangleMax > polygonMin + 1e-6;
  });
};

/** Passage depth required in front of a door, measured from the wall face (m). */
export const DOOR_STAIR_PASSAGE_DEPTH = 0.9;

export const doorPassagePolygons = (wall: Wall, door: Door): Vec2[][] => {
  const { center, direction, normal } = openingPlacement(wall, door);
  const halfWidth = door.width / 2;
  const wallFace = wall.thickness / 2;

  return [-1, 1].map((side) => {
    const inner = wallFace;
    const outer = wallFace + DOOR_STAIR_PASSAGE_DEPTH;
    return [
      vecAdd(vecAdd(center, vecScale(direction, -halfWidth)), vecScale(normal, side * inner)),
      vecAdd(vecAdd(center, vecScale(direction, halfWidth)), vecScale(normal, side * inner)),
      vecAdd(vecAdd(center, vecScale(direction, halfWidth)), vecScale(normal, side * outer)),
      vecAdd(vecAdd(center, vecScale(direction, -halfWidth)), vecScale(normal, side * outer)),
    ];
  });
};

/** Test a door passage against one specific stair shape. */
export const doorBlockedByStairShape = (upper: Floor, door: Door, stair: StairShape): boolean => {
  const wall = upper.walls.find((item) => item.id === door.wallId);
  if (!wall) return false;
  const passages = doorPassagePolygons(wall, door);
  return passages.some((passage) => stair.openings.some((opening) => polygonIntersectsBounds(passage, opening)));
};

/** Test a door passage against every stair on the floor below. */
export const doorBlockedByStair = (plan: Plan, upperFloorIndex: number, door: Door): boolean => {
  const upper = plan.floors[upperFloorIndex];
  const lower = plan.floors[upperFloorIndex - 1];
  if (!upper || !lower || upperFloorIndex < 1) return false;

  return lower.furniture.some((item) => {
    if (!isStairs(item.type)) return false;
    const stair = buildStairShape(item, lower.height + LEVEL_SLAB_THICKNESS);
    return doorBlockedByStairShape(upper, door, stair);
  });
};

export interface StairCheck {
  /** Name of the room reached at the top, when the stair lands in a room. */
  arrivalRoom: string | null;
  issues: string[];
}

/**
 * Explains, in French, why a stairs item does not lead upstairs properly:
 * no level above, a model too small for its flights, a wall in the way on
 * either level, or an arrival that is blocked or outside the house.
 */
export const checkStairs = (plan: Plan, floorIndex: number, item: Furniture): StairCheck => {
  const lower = plan.floors[floorIndex];
  const upper = plan.floors[floorIndex + 1];
  if (!upper) {
    return {
      arrivalRoom: null,
      issues: ["Aucun niveau au-dessus : cet escalier ne mène nulle part. Ajoutez un étage."],
    };
  }
  const stair = buildStairShape(item, lower.height + LEVEL_SLAB_THICKNESS);
  const issues: string[] = [];
  if (stair.pieces.some((piece) => piece.kind === "flight" && piece.length < MIN_FLIGHT_LENGTH)) {
    issues.push("Escalier trop petit pour ce modèle : agrandissez sa largeur ou sa profondeur.");
  }

  const lowerWalls = floorSolids(lower);
  const upperWalls = floorSolids(upper);
  if (crossesStair(stair, lowerWalls)) issues.push(`L'escalier traverse un mur (${lower.name}).`);
  if (crossesStair(stair, upperWalls)) issues.push(`La trémie traverse un mur (${upper.name}).`);

  const blockedDoors = upper.doors.filter((door) => doorBlockedByStairShape(upper, door, stair));
  if (blockedDoors.length === 1) {
    issues.push(`Une porte de l'étage est bloquée par la trémie de l'escalier (${upper.name}).`);
  } else if (blockedDoors.length > 1) {
    issues.push(`${blockedDoors.length} portes de l'étage sont bloquées par la trémie de l'escalier (${upper.name}).`);
  }

  // The visitor must be able to step off at the top…
  const lastPiece = stair.pieces[stair.pieces.length - 1];
  const halfInner = lastPiece.width / 2 - EDGE_TOLERANCE;
  const arrival = vecAdd(stair.exit.center, vecScale(stair.exit.direction, 0.45));
  const arrivalRoom = upper.rooms.find((room) => !isOutdoorRoom(room) && isPointInRoom(room, arrival)) ?? null;
  if (!arrivalRoom) {
    issues.push(`L'arrivée de l'escalier donne hors de l'${upper.name.toLowerCase()} ou sur l'extérieur.`);
  } else if (
    upperWalls.some((wall) => crossesArea(lastPiece, wall, lastPiece.length - 0.1, lastPiece.length + 0.6, halfInner))
  ) {
    issues.push(`L'arrivée de l'escalier est bloquée par un mur (${upper.name}).`);
  }

  // …and to step on at the bottom.
  const firstPiece = stair.pieces[0];
  const departure = vecAdd(stair.entry.center, vecScale(stair.entry.direction, -0.45));
  if (
    !isInsideIndoorRoom(lower, departure) ||
    lowerWalls.some((wall) => crossesArea(firstPiece, wall, -0.6, 0.1, firstPiece.width / 2 - EDGE_TOLERANCE))
  ) {
    issues.push(`Le départ de l'escalier est bloqué (${lower.name}).`);
  }

  return { arrivalRoom: arrivalRoom?.name ?? null, issues };
};

/** All stairs issues of a plan, keyed by stairs item id (only items with issues). */
export const stairIssues = (plan: Plan): Map<string, string[]> => {
  const result = new Map<string, string[]>();
  plan.floors.forEach((floor, index) => {
    for (const item of floor.furniture) {
      if (!isStairs(item.type)) continue;
      const { issues } = checkStairs(plan, index, item);
      if (issues.length > 0) result.set(item.id, issues);
    }
  });
  return result;
};
