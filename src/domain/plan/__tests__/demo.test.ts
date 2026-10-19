import { describe, expect, it } from "vitest";
import { buildDemoPlan } from "../demo";
import { buildWallSegments, floorArea, isOutdoorRoom, wallLength } from "../geometry";
import { planSchema } from "../schema";

describe("demo project", () => {
  const plan = buildDemoPlan();

  it("matches the announced areas: 300 m² lot, 108 + 84 m² of indoor rooms", () => {
    expect(plan.lot.width * plan.lot.depth).toBe(300);
    expect(plan.floors).toHaveLength(2);
    const indoor = (index: number) => ({ ...plan.floors[index], rooms: plan.floors[index].rooms.filter((room) => !isOutdoorRoom(room)) });
    expect(floorArea(indoor(0))).toBeCloseTo(108, 6);
    expect(floorArea(indoor(1))).toBeCloseTo(84, 6);
    expect(plan.floors.flatMap((floor) => floor.rooms).filter(isOutdoorRoom).map((room) => room.name)).toEqual(["Carport", "Terrasse", "Piscine", "Balcon"]);
  });

  it("contains the required rooms", () => {
    const types = plan.floors.flatMap((floor) => floor.rooms.map((room) => room.type));
    expect(types.filter((type) => type === "bedroom")).toHaveLength(3);
    expect(types.filter((type) => type === "bathroom")).toHaveLength(2);
    for (const type of ["living", "kitchen", "toilet", "hallway", "garage", "office"]) {
      expect(types).toContain(type);
    }
  });

  it("is valid against the plan schema and has unique ids", () => {
    expect(planSchema.safeParse(plan).success).toBe(true);
    const ids = [
      plan.id,
      ...plan.materials.map((material) => material.id),
      ...plan.floors.flatMap((item) => [
        item.id,
        ...item.rooms.map((room) => room.id),
        ...item.walls.map((wall) => wall.id),
        ...item.doors.map((door) => door.id),
        ...item.windows.map((window) => window.id),
        ...item.furniture.map((furniture) => furniture.id),
      ]),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("places every door and window inside an existing wall, on every floor", () => {
    for (const floor of plan.floors) {
      const walls = new Map(floor.walls.map((wall) => [wall.id, wall]));
      for (const opening of [...floor.doors, ...floor.windows]) {
        const wall = walls.get(opening.wallId);
        expect(wall, opening.id).toBeDefined();
        if (!wall) continue;
        const length = wallLength(wall);
        expect(opening.offset - opening.width / 2, opening.id).toBeGreaterThanOrEqual(-1e-6);
        expect(opening.offset + opening.width / 2, opening.id).toBeLessThanOrEqual(length + 1e-6);
      }
    }
  });

  it("keeps every opening after wall merging and places furniture inside rooms", () => {
    for (const floor of plan.floors) {
      const segments = buildWallSegments(floor);
      const attached = segments.flatMap((segment) => segment.openings.map((opening) => opening.id));
      expect(attached, floor.name).toHaveLength(floor.doors.length + floor.windows.length);
      for (const item of floor.furniture) {
        const inside = floor.rooms.some(
          (room) => item.x > room.x && item.x < room.x + room.width && item.y > room.y && item.y < room.y + room.depth,
        );
        expect(inside, item.id).toBe(true);
      }
    }
  });

  it("uses the contemporary style: flat roof with a deep overhang, stone and wood façades, pool and carport", () => {
    expect(plan.settings.roofType).toBe("flat");
    expect(plan.settings.roofOverhang).toBeGreaterThanOrEqual(1);
    const walls = plan.floors.flatMap((floor) => floor.walls);
    expect(walls.some((wall) => wall.materialId === "demo-material-stone-cladding")).toBe(true);
    expect(walls.some((wall) => wall.materialId === "demo-material-wood-cladding")).toBe(true);
    expect(walls.some((wall) => wall.materialId === "demo-material-interior-anthracite")).toBe(true);
    const types = plan.floors[0].rooms.map((room) => room.type);
    expect(types).toContain("pool");
    expect(types).toContain("carport");
  });
});
