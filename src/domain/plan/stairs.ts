import {
  buildSolidSegments,
  buildWallSegments,
  clamp,
  isOutdoorRoom,
  isPointInRoom,
  LEVEL_SLAB_THICKNESS,
  projectOnSegment,
  vecAdd,
  vecDot,
  vecScale,
  vecSub,
  type Bounds,
  type SolidSegment,
} from "./geometry";
import type { Floor, Furniture, Plan, Vec2 } from "./schema";

/** Comfortable riser height used to count the steps of a flight (m). */
const TARGET_RISER = 0.175;
/** Thickness given to the virtual walls around a flight or a stairwell (m). */
const RAIL_HALF_THICKNESS = 0.03;
/** Inner margin so that walls touching the edge of a flight are not reported as crossing it (m). */
const EDGE_TOLERANCE = 0.05;

/**
 * A straight flight of stairs drawn on a floor, connecting it to the next
 * level. The stairs item is a rectangle (width × depth) rotated by
 * `rotation` degrees; it climbs towards its local "north" (plan -y at 0°).
 */
export interface StairFlight {
  id: string;
  item: Furniture;
  lowerIndex: number;
  upperIndex: number;
  /** Center of the bottom edge, where the climb starts (plan meters). */
  bottom: Vec2;
  /** Unit vector of the climb, from the bottom edge to the top edge. */
  direction: Vec2;
  /** Unit vector across the flight (direction rotated +90°). */
  across: Vec2;
  run: number;
  width: number;
  /** Height climbed: from the lower floor to the finished floor of the upper level. */
  rise: number;
  steps: number;
  /** Bottom-left, bottom-right, top-right, top-left (left/right seen while climbing). */
  corners: [Vec2, Vec2, Vec2, Vec2];
  /** Axis-aligned stairwell cut in the upper slab (and the lower ceiling). */
  opening: Bounds;
}

/** Climb direction of a stairs item rotated by `rotation` degrees (0° climbs towards -y). */
export const stairDirection = (rotation: number): Vec2 => {
  const radians = (rotation * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
};

const createFlight = (plan: Plan, item: Furniture, lowerIndex: number): StairFlight => {
  const lower = plan.floors[lowerIndex];
  const direction = stairDirection(item.rotation);
  const across = { x: -direction.y, y: direction.x };
  const center = { x: item.x, y: item.y };
  const bottom = vecAdd(center, vecScale(direction, -item.depth / 2));
  const top = vecAdd(center, vecScale(direction, item.depth / 2));
  const half = vecScale(across, item.width / 2);
  const corners: StairFlight["corners"] = [vecSub(bottom, half), vecAdd(bottom, half), vecAdd(top, half), vecSub(top, half)];
  const rise = lower.height + LEVEL_SLAB_THICKNESS;
  return {
    id: item.id,
    item,
    lowerIndex,
    upperIndex: lowerIndex + 1,
    bottom,
    direction,
    across,
    run: item.depth,
    width: item.width,
    rise,
    steps: Math.max(3, Math.round(rise / TARGET_RISER)),
    corners,
    opening: {
      minX: Math.min(...corners.map((corner) => corner.x)),
      minY: Math.min(...corners.map((corner) => corner.y)),
      maxX: Math.max(...corners.map((corner) => corner.x)),
      maxY: Math.max(...corners.map((corner) => corner.y)),
    },
  };
};

/** Every stairs item that has a level above it becomes a flight (floors are sorted by level). */
export const buildStairFlights = (plan: Plan): StairFlight[] =>
  plan.floors.flatMap((floor, index) =>
    index < plan.floors.length - 1 ? floor.furniture.filter((item) => item.type === "stairs").map((item) => createFlight(plan, item, index)) : [],
  );

/** Position along the flight: 0 at the bottom edge, 1 at the top edge. */
export const flightProgress = (flight: StairFlight, point: Vec2): number => vecDot(vecSub(point, flight.bottom), flight.direction) / flight.run;

const acrossOffset = (flight: StairFlight, point: Vec2): number => vecDot(vecSub(point, flight.bottom), flight.across);

export const isOnFlight = (flight: StairFlight, point: Vec2): boolean => {
  const t = flightProgress(flight, point);
  return t >= 0 && t <= 1 && Math.abs(acrossOffset(flight, point)) <= flight.width / 2;
};

/** Height of the walking surface above the lower floor at `point`. */
export const flightElevation = (flight: StairFlight, point: Vec2): number => clamp(flightProgress(flight, point), 0, 1) * flight.rise;

const edge = (start: Vec2, end: Vec2): SolidSegment => ({ start, end, halfThickness: RAIL_HALF_THICKNESS });

/** The two long sides (handrails) of a flight. */
export const flightSideSolids = (flight: StairFlight): SolidSegment[] => {
  const [bottomLeft, bottomRight, topRight, topLeft] = flight.corners;
  return [edge(bottomLeft, topLeft), edge(bottomRight, topRight)];
};

/** On the lower floor the flight can only be entered from its bottom edge. */
export const lowerFlightSolids = (flight: StairFlight): SolidSegment[] => {
  const [, , topRight, topLeft] = flight.corners;
  return [...flightSideSolids(flight), edge(topLeft, topRight)];
};

/** On the upper floor the stairwell is guarded on every side except the arrival (top) edge. */
export const upperFlightSolids = (flight: StairFlight): SolidSegment[] => {
  const [bottomLeft, bottomRight] = flight.corners;
  return [...flightSideSolids(flight), edge(bottomLeft, bottomRight)];
};

/** Splits `rect` into the (up to four) rectangles left once `hole` is removed. */
export const subtractRect = (rect: Bounds, hole: Bounds): Bounds[] => {
  const overlaps = hole.minX < rect.maxX && hole.maxX > rect.minX && hole.minY < rect.maxY && hole.maxY > rect.minY;
  if (!overlaps) return [rect];
  const minY = Math.max(rect.minY, hole.minY);
  const maxY = Math.min(rect.maxY, hole.maxY);
  const pieces: Bounds[] = [
    { minX: rect.minX, maxX: rect.maxX, minY: rect.minY, maxY: hole.minY },
    { minX: rect.minX, maxX: rect.maxX, minY: hole.maxY, maxY: rect.maxY },
    { minX: rect.minX, maxX: hole.minX, minY, maxY },
    { minX: hole.maxX, maxX: rect.maxX, minY, maxY },
  ];
  return pieces.filter((piece) => piece.maxX - piece.minX > 1e-6 && piece.maxY - piece.minY > 1e-6);
};

/** `subtractRect` applied for several holes. */
export const subtractRects = (rect: Bounds, holes: Bounds[]): Bounds[] =>
  holes.reduce<Bounds[]>((pieces, hole) => pieces.flatMap((piece) => subtractRect(piece, hole)), [rect]);

/**
 * Does a (thick) wall segment cross the flight rectangle shrunk by a margin?
 * Liang–Barsky clipping in the flight's frame, the rectangle being grown by
 * the wall's half thickness.
 */
const crossesFlightArea = (flight: StairFlight, wall: SolidSegment, from: number, to: number, halfWidth: number): boolean => {
  const toLocal = (point: Vec2) => ({ u: vecDot(vecSub(point, flight.bottom), flight.direction), v: vecDot(vecSub(point, flight.bottom), flight.across) });
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

const floorSolids = (floor: Floor): SolidSegment[] => buildSolidSegments(buildWallSegments(floor));

const isInsideIndoorRoom = (floor: Floor, point: Vec2): boolean =>
  floor.rooms.some((room) => !isOutdoorRoom(room) && isPointInRoom(room, point));

export interface StairCheck {
  /** Name of the room reached at the top, when the flight lands in a room. */
  arrivalRoom: string | null;
  issues: string[];
}

/**
 * Explains, in French, why a stairs item does not lead upstairs properly:
 * no level above, a wall in the way on either level, or an arrival that is
 * blocked or outside the house.
 */
export const checkStairs = (plan: Plan, floorIndex: number, item: Furniture): StairCheck => {
  const lower = plan.floors[floorIndex];
  const upper = plan.floors[floorIndex + 1];
  if (!upper) {
    return { arrivalRoom: null, issues: ["Aucun niveau au-dessus : cet escalier ne mène nulle part. Ajoutez un étage."] };
  }
  const flight = createFlight(plan, item, floorIndex);
  const issues: string[] = [];
  const halfInner = flight.width / 2 - EDGE_TOLERANCE;

  if (floorSolids(lower).some((wall) => crossesFlightArea(flight, wall, EDGE_TOLERANCE, flight.run - EDGE_TOLERANCE, halfInner))) {
    issues.push(`L'escalier traverse un mur (${lower.name}).`);
  }
  const upperWalls = floorSolids(upper);
  if (upperWalls.some((wall) => crossesFlightArea(flight, wall, EDGE_TOLERANCE, flight.run - EDGE_TOLERANCE, halfInner))) {
    issues.push(`La trémie traverse un mur (${upper.name}).`);
  }

  // The visitor must be able to step off at the top…
  const arrival = vecAdd(flight.bottom, vecScale(flight.direction, flight.run + 0.45));
  const arrivalRoom = upper.rooms.find((room) => !isOutdoorRoom(room) && isPointInRoom(room, arrival)) ?? null;
  if (!arrivalRoom) {
    issues.push(`L'arrivée de l'escalier donne hors de l'${upper.name.toLowerCase()} ou sur l'extérieur.`);
  } else if (upperWalls.some((wall) => crossesFlightArea(flight, wall, flight.run - 0.1, flight.run + 0.6, halfInner))) {
    issues.push(`L'arrivée de l'escalier est bloquée par un mur (${upper.name}).`);
  }

  // …and to step on at the bottom.
  const departure = vecAdd(flight.bottom, vecScale(flight.direction, -0.45));
  if (!isInsideIndoorRoom(lower, departure) || floorSolids(lower).some((wall) => crossesFlightArea(flight, wall, -0.6, 0.1, halfInner))) {
    issues.push(`Le départ de l'escalier est bloqué (${lower.name}).`);
  }

  return { arrivalRoom: arrivalRoom?.name ?? null, issues };
};

/** All stairs issues of a plan, keyed by stairs item id (only items with issues). */
export const stairIssues = (plan: Plan): Map<string, string[]> => {
  const result = new Map<string, string[]>();
  plan.floors.forEach((floor, index) => {
    for (const item of floor.furniture) {
      if (item.type !== "stairs") continue;
      const { issues } = checkStairs(plan, index, item);
      if (issues.length > 0) result.set(item.id, issues);
    }
  });
  return result;
};

/** Distance from a point to the closest wall of a floor (used to decide where handrails are needed). */
export const distanceToWalls = (walls: SolidSegment[], point: Vec2): number =>
  walls.reduce((best, wall) => Math.min(best, projectOnSegment(wall, point).distance - wall.halfThickness), Infinity);
