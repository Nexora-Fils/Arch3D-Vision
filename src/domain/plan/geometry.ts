import type { Door, Floor, Plan, Room, Vec2, Wall, WallSide, Window } from "./schema";
import { WALL_SIDES } from "./schema";

export const EPSILON = 1e-3;
/** Thickness of the slab separating two levels (m). */
export const LEVEL_SLAB_THICKNESS = 0.25;

// ---------------------------------------------------------------------------
// Basic vector helpers
// ---------------------------------------------------------------------------

export const vecAdd = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const vecSub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const vecScale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const vecDot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const vecLength = (a: Vec2): number => Math.hypot(a.x, a.y);
export const vecNormalize = (a: Vec2): Vec2 => {
  const length = vecLength(a);
  return length < EPSILON ? { x: 1, y: 0 } : vecScale(a, 1 / length);
};
/** Perpendicular (rotated +90°) vector. */
export const vecPerp = (a: Vec2): Vec2 => ({ x: -a.y, y: a.x });

export const angleOf = (direction: Vec2): number => Math.atan2(direction.y, direction.x);

export const roundTo = (value: number, step = 0.01): number => Math.round(value / step) * step;

export const snapToGrid = (value: number, step: number): number => (step > 0 ? roundTo(value, step) : value);

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

export const roomArea = (room: Room): number => room.width * room.depth;

export const floorArea = (floor: Floor): number => floor.rooms.reduce((sum, room) => sum + roomArea(room), 0);

export const formatArea = (area: number): string => `${area.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m²`;

export const formatMeters = (value: number): string =>
  `${value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} m`;

// ---------------------------------------------------------------------------
// Rooms & their walls
// ---------------------------------------------------------------------------

export interface Segment {
  start: Vec2;
  end: Vec2;
}

/** The four sides of a rectangular room, clockwise, starting top-left. */
export const roomSides = (room: Room): Record<WallSide, Segment> => {
  const topLeft = { x: room.x, y: room.y };
  const topRight = { x: room.x + room.width, y: room.y };
  const bottomRight = { x: room.x + room.width, y: room.y + room.depth };
  const bottomLeft = { x: room.x, y: room.y + room.depth };
  return {
    north: { start: topLeft, end: topRight },
    east: { start: topRight, end: bottomRight },
    south: { start: bottomRight, end: bottomLeft },
    west: { start: bottomLeft, end: topLeft },
  };
};

export const roomCenter = (room: Room): Vec2 => ({
  x: room.x + room.width / 2,
  y: room.y + room.depth / 2,
});

export const isPointInRoom = (room: Room, point: Vec2): boolean =>
  point.x >= room.x - EPSILON &&
  point.x <= room.x + room.width + EPSILON &&
  point.y >= room.y - EPSILON &&
  point.y <= room.y + room.depth + EPSILON;

export const findRoomAt = (floor: Floor, point: Vec2): Room | undefined =>
  floor.rooms.find((room) => isPointInRoom(room, point));

/** Terraces, balconies, pools and carports are open-air: no walls, no roof, no interior. */
export const isOutdoorRoom = (room: Pick<Room, "type">): boolean =>
  room.type === "terrace" || room.type === "pool" || room.type === "carport";

/** Counted in the habitable area (surface habitable): indoor rooms except the garage. Terraces, pools and carports are outdoor. */
export const isHabitableRoom = (room: Pick<Room, "type">): boolean => !isOutdoorRoom(room) && room.type !== "garage";

/** Habitable area of a set of rooms (m²). */
export const habitableArea = (rooms: Pick<Room, "type" | "width" | "depth">[]): number =>
  rooms.filter(isHabitableRoom).reduce((sum, room) => sum + room.width * room.depth, 0);

export interface WallDefaults {
  thickness: number;
  height: number;
  materialId: string | null;
}

export const createRoomWalls = (room: Room, defaults: WallDefaults, createId: () => string): Wall[] => {
  const sides = roomSides(room);
  return WALL_SIDES.map((side) => ({
    id: createId(),
    roomId: room.id,
    side,
    start: sides[side].start,
    end: sides[side].end,
    thickness: defaults.thickness,
    height: defaults.height,
    materialId: defaults.materialId,
  }));
};

/** Re-aligns the walls attached to a room after the room rectangle changed. */
export const syncRoomWalls = (walls: Wall[], room: Room): Wall[] => {
  const sides = roomSides(room);
  return walls.map((wall) => {
    if (wall.roomId !== room.id || !wall.side) return wall;
    const side = sides[wall.side];
    return { ...wall, start: side.start, end: side.end };
  });
};

// ---------------------------------------------------------------------------
// Walls & openings
// ---------------------------------------------------------------------------

export const wallLength = (wall: Segment): number => vecLength(vecSub(wall.end, wall.start));

export const wallDirection = (wall: Segment): Vec2 => vecNormalize(vecSub(wall.end, wall.start));

export const pointAlongWall = (wall: Segment, offset: number): Vec2 =>
  vecAdd(wall.start, vecScale(wallDirection(wall), offset));

/** Keeps an opening fully inside its wall. */
export const clampOpeningOffset = (wall: Segment, width: number, offset: number): number => {
  const length = wallLength(wall);
  if (width >= length) return length / 2;
  return clamp(offset, width / 2, length - width / 2);
};

export interface WallHit {
  wall: Wall;
  offset: number;
  distance: number;
}

/** Closest point on a segment, returned as the parameter t ∈ [0, length]. */
export const projectOnSegment = (segment: Segment, point: Vec2): { offset: number; distance: number } => {
  const direction = wallDirection(segment);
  const length = wallLength(segment);
  const offset = clamp(vecDot(vecSub(point, segment.start), direction), 0, length);
  const closest = vecAdd(segment.start, vecScale(direction, offset));
  return { offset, distance: vecLength(vecSub(point, closest)) };
};

export const findWallAt = (floor: Floor, point: Vec2, tolerance: number): WallHit | undefined => {
  let best: WallHit | undefined;
  for (const wall of floor.walls) {
    const { offset, distance } = projectOnSegment(wall, point);
    if (distance <= tolerance + wall.thickness / 2 && (!best || distance < best.distance)) {
      best = { wall, offset, distance };
    }
  }
  return best;
};

export const translateWall = (wall: Wall, delta: Vec2): Wall => ({
  ...wall,
  start: vecAdd(wall.start, delta),
  end: vecAdd(wall.end, delta),
});

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Returns the closest existing floor below the given level. */
export const floorBelow = (floors: Floor[], level: number): Floor | null =>
  floors.reduce<Floor | null>(
    (closest, candidate) =>
      candidate.level < level && (!closest || candidate.level > closest.level) ? candidate : closest,
    null,
  );

export const floorBounds = (floor: Floor, options: { indoorOnly?: boolean } = {}): Bounds | null => {
  const points: Vec2[] = [];
  for (const room of floor.rooms) {
    if (options.indoorOnly && isOutdoorRoom(room)) continue;
    points.push({ x: room.x, y: room.y }, { x: room.x + room.width, y: room.y + room.depth });
  }
  for (const wall of floor.walls) {
    points.push(wall.start, wall.end);
  }
  if (points.length === 0) return null;
  return points.reduce<Bounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
};

/** Bounds of a floor's indoor rooms and walls. */
export const indoorBounds = (floor: Floor): Bounds | null =>
  floorBounds({ ...floor, rooms: floor.rooms.filter((room) => !isOutdoorRoom(room)) }, { indoorOnly: true });

const isRoomCoveredBy = (room: Room, coveringRooms: Room[]): boolean => {
  const maxX = room.x + room.width;
  const maxY = room.y + room.depth;
  const xCoordinates = [room.x, maxX];
  const yCoordinates = [room.y, maxY];

  for (const candidate of coveringRooms) {
    const candidateMaxX = candidate.x + candidate.width;
    const candidateMaxY = candidate.y + candidate.depth;
    if (candidateMaxX <= room.x || candidate.x >= maxX || candidateMaxY <= room.y || candidate.y >= maxY) continue;
    xCoordinates.push(Math.max(room.x, candidate.x), Math.min(maxX, candidateMaxX));
    yCoordinates.push(Math.max(room.y, candidate.y), Math.min(maxY, candidateMaxY));
  }

  const uniqueSorted = (coordinates: number[]) =>
    coordinates
      .sort((a, b) => a - b)
      .filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > EPSILON);
  const xs = uniqueSorted(xCoordinates);
  const ys = uniqueSorted(yCoordinates);

  for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
    for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
      const point = { x: (xs[xIndex] + xs[xIndex + 1]) / 2, y: (ys[yIndex] + ys[yIndex + 1]) / 2 };
      if (!coveringRooms.some((candidate) => isPointInRoom(candidate, point))) return false;
    }
  }
  return true;
};

/** Rooms on an upper floor that extend beyond the footprint of the level below. */
export const roomsOutsideFloorFootprint = (floor: Floor, lowerFloor: Floor): Room[] => {
  const rooms = floor.rooms.filter((room) => !isOutdoorRoom(room));
  const lowerRooms = lowerFloor.rooms.filter((room) => !isOutdoorRoom(room));
  if (lowerRooms.length > 0) return rooms.filter((room) => !isRoomCoveredBy(room, lowerRooms));

  const bounds = indoorBounds(lowerFloor);
  if (!bounds) return [];
  return rooms.filter(
    (room) =>
      room.x < bounds.minX - EPSILON ||
      room.y < bounds.minY - EPSILON ||
      room.x + room.width > bounds.maxX + EPSILON ||
      room.y + room.depth > bounds.maxY + EPSILON,
  );
};

/** Opening center and direction in plan coordinates (for the 2D editor). */
export const openingPlacement = (wall: Wall, opening: Pick<Door | Window, "offset" | "width">) => {
  const direction = wallDirection(wall);
  const center = pointAlongWall(wall, opening.offset);
  return { center, direction, normal: vecPerp(direction), angle: angleOf(direction) };
};

/** Elevation of a floor's finished ground, from the stacked heights of the levels below (floors sorted by level). */
export const floorBaseHeight = (plan: Pick<Plan, "floors">, floorIndex: number): number =>
  plan.floors.slice(0, floorIndex).reduce((height, floor) => height + floor.height + LEVEL_SLAB_THICKNESS, 0);
