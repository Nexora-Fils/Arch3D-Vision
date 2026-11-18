import { LEVEL_SLAB_THICKNESS, vecAdd, vecScale, type Bounds } from "./geometry";
import type { Furniture, FurnitureType, Plan, Vec2 } from "./schema";

/** Furniture types that are stairs, one per model. */
export const STAIR_TYPES = [
  "stairs",
  "stairs_quarter_left",
  "stairs_quarter_right",
  "stairs_half_turn",
] as const satisfies readonly FurnitureType[];
export type StairType = (typeof STAIR_TYPES)[number];

export const isStairs = (type: FurnitureType): type is StairType =>
  (STAIR_TYPES as readonly FurnitureType[]).includes(type);

/** Comfortable riser height used to count the steps (m). */
const TARGET_RISER = 0.175;
/** Flight width of turning stairs, reduced when the item is too small (m). */
const TURNING_FLIGHT_WIDTH = 0.9;
/** Open well between the two flights of a half-turn stair (m). */
const HALF_TURN_WELL = 0.1;

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
    return {
      flightWidth: width,
      pieces: [{ kind: "flight", rect: { minA: -halfW, maxA: halfW, minC: -halfD, maxC: halfD }, axis: UP }],
      wells: [],
    };
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

const rectLength = (rect: LocalRect, axis: LocalVec): number =>
  axis.c !== 0 ? rect.maxC - rect.minC : rect.maxA - rect.minA;
const rectWidth = (rect: LocalRect, axis: LocalVec): number =>
  axis.c !== 0 ? rect.maxA - rect.minA : rect.maxC - rect.minC;

/** Converts the item frame to plan coordinates. */
export const stairFrame = (item: Pick<Furniture, "x" | "y" | "rotation">) => {
  const direction = stairDirection(item.rotation);
  const right = { x: -direction.y, y: direction.x };
  const toPlan = (local: LocalVec): Vec2 => ({
    x: item.x + right.x * local.a + direction.x * local.c,
    y: item.y + right.y * local.a + direction.y * local.c,
  });
  const toPlanVector = (local: LocalVec): Vec2 => ({
    x: right.x * local.a + direction.x * local.c,
    y: right.y * local.a + direction.y * local.c,
  });
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
  const order = exact
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((left, right) => right.rest - left.rest);
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
  const toEdge = (edge: LocalEdge): StairEdge => ({
    start: toPlan(edge.from),
    end: toPlan(edge.to),
    localStart: edge.from,
    localEnd: edge.to,
    role: edge.role,
    piece: edge.piece,
  });
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
    openings: [
      ...pieces.map((piece) => piece.bounds),
      ...layout.wells.map((rect) => boundsOf(rectCorners(rect).map(toPlan))),
    ],
    entry: { center: firstPiece.start, direction: firstPiece.direction },
    exit: {
      center: vecAdd(lastPiece.start, vecScale(lastPiece.direction, lastPiece.length)),
      direction: lastPiece.direction,
    },
  };
};

/** Every stairs item that has a level above it becomes a flight (floors are sorted by level). */
export const buildStairFlights = (plan: Plan): StairFlight[] =>
  plan.floors.flatMap((floor, index) =>
    index < plan.floors.length - 1
      ? floor.furniture
          .filter((item) => isStairs(item.type))
          .map((item) => ({
            ...buildStairShape(item, floor.height + LEVEL_SLAB_THICKNESS),
            id: item.id,
            lowerIndex: index,
            upperIndex: index + 1,
          }))
      : [],
  );

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
