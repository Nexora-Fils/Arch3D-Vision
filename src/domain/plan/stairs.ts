import {
  buildSolidSegments,
  buildWallSegments,
  clamp,
  isOutdoorRoom,
  isPointInRoom,
  LEVEL_SLAB_THICKNESS,
  openingPlacement,
  projectOnSegment,
  vecAdd,
  vecDot,
  vecNormalize,
  vecPerp,
  vecScale,
  vecSub,
  type Bounds,
  type SolidSegment,
} from "./geometry";
import type { Door, Floor, Furniture, FurnitureType, Plan, Vec2 } from "./schema";

/** Furniture types that are stairs, one per model. */
export const STAIR_TYPES = ["stairs", "stairs_quarter_left", "stairs_quarter_right", "stairs_half_turn"] as const satisfies readonly FurnitureType[];
export type StairType = (typeof STAIR_TYPES)[number];

export const isStairs = (type: FurnitureType): type is StairType => (STAIR_TYPES as readonly FurnitureType[]).includes(type);

/** Comfortable riser height used to count the steps (m). */
const TARGET_RISER = 0.175;
/** Thickness given to the virtual walls around a stair or a stairwell (m). */
const RAIL_HALF_THICKNESS = 0.03;
/** Inner margin so that walls touching the edge of a stair are not reported as crossing it (m). */
const EDGE_TOLERANCE = 0.05;
/** Flight width of turning stairs, reduced when the item is too small (m). */
const TURNING_FLIGHT_WIDTH = 0.9;
/** Open well between the two flights of a half-turn stair (m). */
const HALF_TURN_WELL = 0.1;
/** Shortest usable flight (m). */
const MIN_FLIGHT_LENGTH = 0.5;
/** Tolerance when locating a point on the stair (m). */
const LOCATE_EPSILON = 0.02;

/**
 * Stair layout in the item's own frame: `a` runs to the right of a person
 * climbing the first flight, `c` up the first flight (towards the item's
 * local north, plan -y at 0°). The item rectangle is the bounding box.
 */
export interface LocalVec {
  a: number;
  c: number;
}

export interface LocalRect {
  minA: number;
  maxA: number;
  minC: number;
  maxC: number;
}

/** A flight (steps climbing along `axis`) or a landing (flat), axis-aligned in the item frame. */
export interface StairPiece {
  kind: "flight" | "landing";
  rect: LocalRect;
  /** Walking direction: the climb for a flight, the arriving flight's climb for a landing. */
  axis: LocalVec;
  steps: number;
  /** Height above the lower floor where the piece starts and ends (equal for a landing). */
  fromHeight: number;
  toHeight: number;
  /** Plan frame: center of the entry edge, unit direction, unit vector to the right, extents. */
  start: Vec2;
  direction: Vec2;
  across: Vec2;
  length: number;
  width: number;
  corners: [Vec2, Vec2, Vec2, Vec2];
  bounds: Bounds;
}

/** Part of the outline of a stair, in plan and in the item frame. */
export interface StairEdge {
  start: Vec2;
  end: Vec2;
  localStart: LocalVec;
  localEnd: LocalVec;
  /** "entry": where the climb starts; "exit": the arrival; "side": everything else. */
  role: "side" | "entry" | "exit";
  /** Index of the piece the edge belongs to; -1 for the well of a half-turn stair. */
  piece: number;
}

export interface StairShape {
  item: Furniture;
  type: StairType;
  /** Height climbed (m). */
  rise: number;
  riser: number;
  /** Treads, landing included. */
  steps: number;
  flightWidth: number;
  pieces: StairPiece[];
  /** Outline of the walkable pieces: rails while climbing. */
  edges: StairEdge[];
  /** Outline of the whole footprint (pieces and well): stairwell guards. */
  footprintEdges: StairEdge[];
  /** Axis-aligned rectangles cut in the slab above (pieces and well). */
  openings: Bounds[];
  entry: { center: Vec2; direction: Vec2 };
  exit: { center: Vec2; direction: Vec2 };
}

/** A stair connecting a floor to the next level. */
export interface StairFlight extends StairShape {
  id: string;
  lowerIndex: number;
  upperIndex: number;
}

/** Climb direction of the first flight of a stairs item rotated by `rotation` degrees (0° climbs towards -y). */
export const stairDirection = (rotation: number): Vec2 => {
  const radians = (rotation * Math.PI) / 180;
  return { x: Math.sin(radians), y: -Math.cos(radians) };
};

interface LocalLayout {
  flightWidth: number;
  pieces: { kind: StairPiece["kind"]; rect: LocalRect; axis: LocalVec }[];
  wells: LocalRect[];
}

const UP: LocalVec = { a: 0, c: 1 };
const DOWN: LocalVec = { a: 0, c: -1 };

/** Flights and landings of each stair model inside the item's width × depth. */
export const stairLayout = (type: StairType, width: number, depth: number): LocalLayout => {
  const halfW = width / 2;
  const halfD = depth / 2;
  if (type === "stairs") {
    return { flightWidth: width, pieces: [{ kind: "flight", rect: { minA: -halfW, maxA: halfW, minC: -halfD, maxC: halfD }, axis: UP }], wells: [] };
  }
  if (type === "stairs_half_turn") {
    // Up the left column, across the full-width landing, back down the right column (climbing).
    const w = Math.max(0.3, (width - HALF_TURN_WELL) / 2);
    return {
      flightWidth: w,
      pieces: [
        { kind: "flight", rect: { minA: -halfW, maxA: -halfW + w, minC: -halfD, maxC: halfD - w }, axis: UP },
        { kind: "landing", rect: { minA: -halfW, maxA: halfW, minC: halfD - w, maxC: halfD }, axis: UP },
        { kind: "flight", rect: { minA: halfW - w, maxA: halfW, minC: -halfD, maxC: halfD - w }, axis: DOWN },
      ],
      wells: [{ minA: -halfW + w, maxA: halfW - w, minC: -halfD, maxC: halfD - w }],
    };
  }
  // Quarter turn: up one column, square landing in the far corner, then along the far row.
  const w = Math.max(0.3, Math.min(TURNING_FLIGHT_WIDTH, width * 0.45, depth * 0.45));
  const side = type === "stairs_quarter_right" ? 1 : -1;
  const column = side === 1 ? { minA: -halfW, maxA: -halfW + w } : { minA: halfW - w, maxA: halfW };
  const row = side === 1 ? { minA: -halfW + w, maxA: halfW } : { minA: -halfW, maxA: halfW - w };
  return {
    flightWidth: w,
    pieces: [
      { kind: "flight", rect: { ...column, minC: -halfD, maxC: halfD - w }, axis: UP },
      { kind: "landing", rect: { ...column, minC: halfD - w, maxC: halfD }, axis: UP },
      { kind: "flight", rect: { ...row, minC: halfD - w, maxC: halfD }, axis: { a: side, c: 0 } },
    ],
    wells: [],
  };
};

type Side = "minA" | "maxA" | "minC" | "maxC";

/** Side of a rectangle crossed when walking in along `axis` (entry) or out along it (exit). */
const entrySide = (axis: LocalVec): Side => (axis.c > 0 ? "minC" : axis.c < 0 ? "maxC" : axis.a > 0 ? "minA" : "maxA");
const exitSide = (axis: LocalVec): Side => (axis.c > 0 ? "maxC" : axis.c < 0 ? "minC" : axis.a > 0 ? "maxA" : "minA");
const OPPOSITE: Record<Side, Side> = { minA: "maxA", maxA: "minA", minC: "maxC", maxC: "minC" };

/** Extent of a rectangle along the axis of one of its sides: [line value, interval start, interval end]. */
const sideLine = (rect: LocalRect, side: Side): [number, number, number] =>
  side === "minA" || side === "maxA" ? [rect[side], rect.minC, rect.maxC] : [rect[side], rect.minA, rect.maxA];

const subtractInterval = (intervals: [number, number][], from: number, to: number): [number, number][] =>
  intervals.flatMap(([start, end]): [number, number][] => {
    if (to <= start + 1e-9 || from >= end - 1e-9) return [[start, end]];
    const parts: [number, number][] = [];
    if (from > start + 1e-9) parts.push([start, from]);
    if (to < end - 1e-9) parts.push([to, end]);
    return parts;
  });

interface LocalEdge {
  from: LocalVec;
  to: LocalVec;
  role: StairEdge["role"];
  piece: number;
}

/**
 * Outline of a union of axis-aligned rectangles that touch along their sides:
 * every side, minus the parts shared with a neighbouring rectangle.
 */
const outline = (rects: { rect: LocalRect; piece: number; entry?: Side; exit?: Side }[]): LocalEdge[] =>
  rects.flatMap(({ rect, piece, entry, exit }) =>
    (["minA", "maxA", "minC", "maxC"] as const).flatMap((side) => {
      const [line, start, end] = sideLine(rect, side);
      let intervals: [number, number][] = [[start, end]];
      for (const other of rects) {
        if (other.rect === rect) continue;
        const [otherLine, otherStart, otherEnd] = sideLine(other.rect, OPPOSITE[side]);
        if (Math.abs(otherLine - line) < 1e-9) intervals = subtractInterval(intervals, otherStart, otherEnd);
      }
      const role: LocalEdge["role"] = side === entry ? "entry" : side === exit ? "exit" : "side";
      const alongC = side === "minA" || side === "maxA";
      return intervals
        .filter(([from, to]) => to - from > 1e-6)
        .map(([from, to]) => ({
          from: alongC ? { a: line, c: from } : { a: from, c: line },
          to: alongC ? { a: line, c: to } : { a: to, c: line },
          role,
          piece,
        }));
    }),
  );

const rectLength = (rect: LocalRect, axis: LocalVec): number => (axis.c !== 0 ? rect.maxC - rect.minC : rect.maxA - rect.minA);
const rectWidth = (rect: LocalRect, axis: LocalVec): number => (axis.c !== 0 ? rect.maxA - rect.minA : rect.maxC - rect.minC);

/** Converts the item frame to plan coordinates. */
export const stairFrame = (item: Pick<Furniture, "x" | "y" | "rotation">) => {
  const direction = stairDirection(item.rotation);
  const right = { x: -direction.y, y: direction.x };
  const toPlan = (local: LocalVec): Vec2 => ({ x: item.x + right.x * local.a + direction.x * local.c, y: item.y + right.y * local.a + direction.y * local.c });
  const toPlanVector = (local: LocalVec): Vec2 => ({ x: right.x * local.a + direction.x * local.c, y: right.y * local.a + direction.y * local.c });
  return { toPlan, toPlanVector };
};

const boundsOf = (points: Vec2[]): Bounds => ({
  minX: Math.min(...points.map((point) => point.x)),
  minY: Math.min(...points.map((point) => point.y)),
  maxX: Math.max(...points.map((point) => point.x)),
  maxY: Math.max(...points.map((point) => point.y)),
});

const rectCorners = (rect: LocalRect): LocalVec[] => [
  { a: rect.minA, c: rect.minC },
  { a: rect.maxA, c: rect.minC },
  { a: rect.maxA, c: rect.maxC },
  { a: rect.minA, c: rect.maxC },
];

/**
 * Geometry of a stairs item climbing `rise` meters: flights and landings with
 * their heights, outlines and stairwell rectangles. Risers are equal; treads
 * are shared between the flights in proportion to their length.
 */
export const buildStairShape = (item: Furniture, rise: number): StairShape => {
  const type: StairType = isStairs(item.type) ? item.type : "stairs";
  const layout = stairLayout(type, item.width, item.depth);
  const { toPlan, toPlanVector } = stairFrame(item);
  const steps = Math.max(3, Math.round(rise / TARGET_RISER));
  const riser = rise / steps;

  const flights = layout.pieces.filter((piece) => piece.kind === "flight");
  const landings = layout.pieces.length - flights.length;
  const lengths = flights.map((piece) => rectLength(piece.rect, piece.axis));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const available = steps - landings;
  // Largest remainder: every flight gets at least one step and the total is exact.
  const exact = lengths.map((length) => (available * length) / total);
  const counts = exact.map((value) => Math.max(1, Math.floor(value)));
  let missing = available - counts.reduce((sum, count) => sum + count, 0);
  const order = exact.map((value, index) => ({ index, rest: value - Math.floor(value) })).sort((left, right) => right.rest - left.rest);
  for (let index = 0; missing > 0; index = (index + 1) % order.length, missing -= 1) counts[order[index].index] += 1;
  for (let index = order.length - 1; missing < 0; index = (index - 1 + order.length) % order.length) {
    if (counts[order[index].index] > 1) {
      counts[order[index].index] -= 1;
      missing += 1;
    }
  }

  let height = 0;
  let flightIndex = 0;
  const pieces: StairPiece[] = layout.pieces.map((piece) => {
    const length = rectLength(piece.rect, piece.axis);
    const width = rectWidth(piece.rect, piece.axis);
    const center = { a: (piece.rect.minA + piece.rect.maxA) / 2, c: (piece.rect.minC + piece.rect.maxC) / 2 };
    const startLocal = { a: center.a - (piece.axis.a * length) / 2, c: center.c - (piece.axis.c * length) / 2 };
    const direction = toPlanVector(piece.axis);
    const corners = rectCorners(piece.rect).map(toPlan) as StairPiece["corners"];
    const pieceSteps = piece.kind === "flight" ? counts[flightIndex++] : 0;
    const fromHeight = piece.kind === "flight" ? height : height + riser;
    const toHeight = piece.kind === "flight" ? height + pieceSteps * riser : fromHeight;
    height = toHeight;
    return {
      kind: piece.kind,
      rect: piece.rect,
      axis: piece.axis,
      steps: pieceSteps,
      fromHeight,
      toHeight,
      start: toPlan(startLocal),
      direction,
      across: { x: -direction.y, y: direction.x },
      length,
      width,
      corners,
      bounds: boundsOf(corners),
    };
  });

  const first = layout.pieces[0];
  const last = layout.pieces[layout.pieces.length - 1];
  const tagged = layout.pieces.map((piece, index) => ({
    rect: piece.rect,
    piece: index,
    entry: index === 0 ? entrySide(first.axis) : undefined,
    exit: index === layout.pieces.length - 1 ? exitSide(last.axis) : undefined,
  }));
  const toEdge = (edge: LocalEdge): StairEdge => ({ start: toPlan(edge.from), end: toPlan(edge.to), localStart: edge.from, localEnd: edge.to, role: edge.role, piece: edge.piece });
  const firstPiece = pieces[0];
  const lastPiece = pieces[pieces.length - 1];
  return {
    item,
    type,
    rise,
    riser,
    steps,
    flightWidth: layout.flightWidth,
    pieces,
    edges: outline(tagged).map(toEdge),
    footprintEdges: outline([...tagged, ...layout.wells.map((rect) => ({ rect, piece: -1 }))]).map(toEdge),
    openings: [...pieces.map((piece) => piece.bounds), ...layout.wells.map((rect) => boundsOf(rectCorners(rect).map(toPlan)))],
    entry: { center: firstPiece.start, direction: firstPiece.direction },
    exit: { center: vecAdd(lastPiece.start, vecScale(lastPiece.direction, lastPiece.length)), direction: lastPiece.direction },
  };
};

/** Every stairs item that has a level above it becomes a flight (floors are sorted by level). */
export const buildStairFlights = (plan: Plan): StairFlight[] =>
  plan.floors.flatMap((floor, index) =>
    index < plan.floors.length - 1
      ? floor.furniture
          .filter((item) => isStairs(item.type))
          .map((item) => ({ ...buildStairShape(item, floor.height + LEVEL_SLAB_THICKNESS), id: item.id, lowerIndex: index, upperIndex: index + 1 }))
      : [],
  );

/** Position of a point in the frame of a piece: `t` from 0 (entry edge) to 1 (far edge), `v` across from its centerline. */
export const pieceCoordinates = (piece: StairPiece, point: Vec2): { t: number; v: number } => {
  const offset = vecSub(point, piece.start);
  return { t: vecDot(offset, piece.direction) / piece.length, v: vecDot(offset, piece.across) };
};

/** Height of the walking surface of a piece at `point` (clamped to the piece). */
export const pieceElevation = (piece: StairPiece, point: Vec2): number =>
  piece.kind === "landing" ? piece.fromHeight : piece.fromHeight + clamp(pieceCoordinates(piece, point).t, 0, 1) * (piece.toHeight - piece.fromHeight);

export type StairLocation = { kind: "piece"; index: number } | { kind: "below" } | { kind: "above" } | { kind: "outside" };

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

const solid = (edge: StairEdge): SolidSegment => ({ start: edge.start, end: edge.end, halfThickness: RAIL_HALF_THICKNESS });

/** Rails around the walkable pieces, open at the entry and the exit. */
export const stairSideSolids = (stair: StairShape): SolidSegment[] => stair.edges.filter((edge) => edge.role === "side").map(solid);

/** On the lower floor the stair can only be entered from its entry edge. */
export const lowerStairSolids = (stair: StairShape): SolidSegment[] => stair.footprintEdges.filter((edge) => edge.role !== "entry").map(solid);

/** On the upper floor the stairwell is guarded on every side except the arrival. */
export const upperStairSolids = (stair: StairShape): SolidSegment[] => stair.footprintEdges.filter((edge) => edge.role !== "exit").map(solid);

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
  const toLocal = (point: Vec2) => ({ u: vecDot(vecSub(point, frame.start), frame.direction), v: vecDot(vecSub(point, frame.start), frame.across) });
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
  stair.pieces.some((piece) => walls.some((wall) => crossesArea(piece, wall, EDGE_TOLERANCE, piece.length - EDGE_TOLERANCE, piece.width / 2 - EDGE_TOLERANCE)));

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
  const direction = vecPerp(vecSub(polygon[1], polygon[0]));
  const axes = [
    { x: 1, y: 0 },
    { y: 1, x: 0 },
    vecNormalize(vecSub(polygon[1], polygon[0])),
    vecNormalize(direction),
  ];

  return axes.every((axis) => {
    const [polygonMin, polygonMax] = projectPolygon(polygon, axis);
    const [rectangleMin, rectangleMax] = projectPolygon(rectangle, axis);
    return polygonMax > rectangleMin + 1e-6 && rectangleMax > polygonMin + 1e-6;
  });
};

/** A 0.9 m deep passage centered on the door opening. */
export const doorBlockedByStair = (plan: Plan, upperFloorIndex: number, door: Door): boolean => {
  const upper = plan.floors[upperFloorIndex];
  const lower = plan.floors[upperFloorIndex - 1];
  if (!upper || !lower || upperFloorIndex < 1) return false;

  const wall = upper.walls.find((item) => item.id === door.wallId);
  if (!wall) return false;
  const { center, direction, normal } = openingPlacement(wall, door);
  const halfWidth = door.width / 2;
  const halfDepth = 0.45;
  const corridor = [
    vecAdd(vecAdd(center, vecScale(direction, -halfWidth)), vecScale(normal, -halfDepth)),
    vecAdd(vecAdd(center, vecScale(direction, halfWidth)), vecScale(normal, -halfDepth)),
    vecAdd(vecAdd(center, vecScale(direction, halfWidth)), vecScale(normal, halfDepth)),
    vecAdd(vecAdd(center, vecScale(direction, -halfWidth)), vecScale(normal, halfDepth)),
  ];

  return lower.furniture.some((item) => {
    if (!isStairs(item.type)) return false;
    const stair = buildStairShape(item, lower.height + LEVEL_SLAB_THICKNESS);
    return stair.openings.some((opening) => polygonIntersectsBounds(corridor, opening));
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
    return { arrivalRoom: null, issues: ["Aucun niveau au-dessus : cet escalier ne mène nulle part. Ajoutez un étage."] };
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

  const blockedDoors = upper.doors.filter((door) => doorBlockedByStair(plan, floorIndex + 1, door));
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
  } else if (upperWalls.some((wall) => crossesArea(lastPiece, wall, lastPiece.length - 0.1, lastPiece.length + 0.6, halfInner))) {
    issues.push(`L'arrivée de l'escalier est bloquée par un mur (${upper.name}).`);
  }

  // …and to step on at the bottom.
  const firstPiece = stair.pieces[0];
  const departure = vecAdd(stair.entry.center, vecScale(stair.entry.direction, -0.45));
  if (!isInsideIndoorRoom(lower, departure) || lowerWalls.some((wall) => crossesArea(firstPiece, wall, -0.6, 0.1, firstPiece.width / 2 - EDGE_TOLERANCE))) {
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

/** Distance from a point to the closest wall of a floor (used to decide where handrails are needed). */
export const distanceToWalls = (walls: SolidSegment[], point: Vec2): number =>
  walls.reduce((best, wall) => Math.min(best, projectOnSegment(wall, point).distance - wall.halfThickness), Infinity);
