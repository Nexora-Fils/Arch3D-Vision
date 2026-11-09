import { describe, expect, it } from "vitest";
import {
  buildSolidSegments,
  buildWallSegments,
  clampOpeningOffset,
  createRoomWalls,
  findRoomAt,
  findWallAt,
  resolveCollisions,
  roomsOutsideFloorFootprint,
  roomArea,
  syncRoomWalls,
} from "../geometry";
import type { Floor, Room } from "../schema";

const room = (id: string, x: number, y: number, width: number, depth: number): Room => ({
  id,
  name: id,
  type: "other",
  x,
  y,
  width,
  depth,
  polygon: null,
  floorMaterialId: null,
});

let counter = 0;
const nextId = () => `id-${(counter += 1)}`;

const floorWith = (rooms: Room[], extra: Partial<Floor> = {}): Floor => ({
  id: "floor",
  name: "RDC",
  level: 0,
  height: 2.7,
  rooms,
  walls: rooms.flatMap((item) => createRoomWalls(item, { thickness: 0.2, height: 2.7, materialId: null }, nextId)),
  doors: [],
  windows: [],
  furniture: [],
  annotations: [],
  ...extra,
});

describe("rooms", () => {
  it("computes the area in square meters", () => {
    expect(roomArea(room("a", 0, 0, 4, 3.5))).toBe(14);
  });

  it("creates four clockwise walls and keeps them in sync after a resize", () => {
    const base = room("a", 1, 1, 4, 3);
    const walls = createRoomWalls(base, { thickness: 0.2, height: 2.7, materialId: null }, nextId);
    expect(walls.map((wall) => wall.side)).toEqual(["north", "east", "south", "west"]);
    expect(walls[1].start).toEqual({ x: 5, y: 1 });
    const synced = syncRoomWalls(walls, { ...base, width: 6 });
    expect(synced[1].start).toEqual({ x: 7, y: 1 });
    expect(synced[2].end).toEqual({ x: 1, y: 4 });
  });

  it("finds the room under a point", () => {
    const floor = floorWith([room("a", 0, 0, 4, 4), room("b", 4, 0, 4, 4)]);
    expect(findRoomAt(floor, { x: 5, y: 1 })?.id).toBe("b");
    expect(findRoomAt(floor, { x: 9, y: 1 })).toBeUndefined();
  });

  it("finds rooms that extend beyond the footprint below, including gaps between rooms", () => {
    const lower = floorWith([room("left", 0, 0, 2, 4), room("right", 3, 0, 2, 4)]);
    const upper = floorWith([room("aligned", 0, 0, 2, 4), room("overhang", 1, 0, 3, 4)]);
    expect(roomsOutsideFloorFootprint(upper, lower).map((item) => item.id)).toEqual(["overhang"]);
  });

  it("accepts a room covered by multiple adjacent rooms below", () => {
    const lower = floorWith([room("left", 0, 0, 2, 4), room("right", 2, 0, 2, 4)]);
    const upper = floorWith([room("upper", 0, 0, 4, 4)]);
    expect(roomsOutsideFloorFootprint(upper, lower)).toEqual([]);
  });
});

describe("buildWallSegments", () => {
  it("merges the shared wall of two adjacent rooms into one segment", () => {
    const floor = floorWith([room("a", 0, 0, 4, 4), room("b", 4, 0, 4, 4)]);
    const segments = buildWallSegments(floor);
    // 8 raw walls: only the shared vertical wall is deduplicated → 7 segments.
    // Collinear neighbours (the two north walls) stay separate so each keeps its material.
    expect(segments).toHaveLength(7);
    const shared = segments.find((segment) => segment.sourceWallIds.length === 2 && segment.length === 4);
    expect(shared).toBeDefined();
    expect(shared?.exteriorSide).toBe(0);
    const norths = segments.filter((segment) => segment.start.y === 0 && segment.end.y === 0);
    expect(norths).toHaveLength(2);
    expect(norths.every((segment) => segment.exteriorSide !== 0)).toBe(true);
  });

  it("attaches doors to the merged segment with a projected offset", () => {
    const floor = floorWith([room("a", 0, 0, 4, 4), room("b", 4, 0, 4, 4)]);
    const sharedWall = floor.walls.find((wall) => wall.roomId === "a" && wall.side === "east");
    if (!sharedWall) throw new Error("missing wall");
    floor.doors.push({ id: "door", wallId: sharedWall.id, offset: 1, width: 0.9, height: 2.1, type: "standard", swing: "left" });
    const segments = buildWallSegments(floor);
    const segment = segments.find((candidate) => candidate.sourceWallIds.includes(sharedWall.id));
    expect(segment?.openings).toHaveLength(1);
    // The merged segment runs from (4,0) to (4,4); the door center is at y = 1.
    expect(segment?.openings[0].offset).toBeCloseTo(1, 6);
  });

  it("drops an opening that overlaps an existing one on the same wall", () => {
    const floor = floorWith([room("a", 0, 0, 4, 4)]);
    const wall = floor.walls[0];
    floor.windows.push(
      { id: "w1", wallId: wall.id, offset: 2, width: 1.2, height: 1.2, sillHeight: 0.9 },
      { id: "w2", wallId: wall.id, offset: 2.4, width: 1.2, height: 1.2, sillHeight: 0.9 },
    );
    const [segment] = buildWallSegments(floor).filter((candidate) => candidate.sourceWallIds.includes(wall.id));
    expect(segment.openings.map((opening) => opening.id)).toEqual(["w1"]);
  });
});

describe("collisions", () => {
  it("removes door spans from the solid pieces", () => {
    const floor = floorWith([room("a", 0, 0, 4, 4)]);
    const wall = floor.walls[0];
    floor.doors.push({ id: "d", wallId: wall.id, offset: 2, width: 1, height: 2.1, type: "standard", swing: "left" });
    const solids = buildSolidSegments(buildWallSegments(floor));
    const northPieces = solids.filter((solid) => solid.start.y === 0 && solid.end.y === 0);
    expect(northPieces).toHaveLength(2);
    expect(northPieces.map((piece) => [piece.start.x, piece.end.x])).toEqual([
      [0, 1.5],
      [2.5, 4],
    ]);
  });

  it("pushes the visitor out of a wall but lets them pass through a door", () => {
    const floor = floorWith([room("a", 0, 0, 4, 4)]);
    const wall = floor.walls[0];
    floor.doors.push({ id: "d", wallId: wall.id, offset: 2, width: 1, height: 2.1, type: "standard", swing: "left" });
    const solids = buildSolidSegments(buildWallSegments(floor));
    const blocked = resolveCollisions({ x: 1, y: 0.05 }, solids, 0.3);
    expect(blocked.y).toBeCloseTo(0.4, 6);
    const throughDoor = resolveCollisions({ x: 2, y: 0.05 }, solids, 0.3);
    expect(throughDoor).toEqual({ x: 2, y: 0.05 });
  });
});

describe("openings", () => {
  it("clamps an opening inside its wall", () => {
    const wall = { start: { x: 0, y: 0 }, end: { x: 3, y: 0 } };
    expect(clampOpeningOffset(wall, 1, 0)).toBe(0.5);
    expect(clampOpeningOffset(wall, 1, 5)).toBe(2.5);
    expect(clampOpeningOffset(wall, 4, 1)).toBe(1.5);
  });

  it("finds the nearest wall with its offset", () => {
    const floor = floorWith([room("a", 0, 0, 4, 4)]);
    const hit = findWallAt(floor, { x: 4.05, y: 1.5 }, 0.2);
    expect(hit?.wall.side).toBe("east");
    expect(hit?.offset).toBeCloseTo(1.5, 6);
    expect(findWallAt(floor, { x: 2, y: 2 }, 0.2)).toBeUndefined();
  });
});
