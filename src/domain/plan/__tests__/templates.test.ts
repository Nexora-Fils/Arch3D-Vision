import { describe, expect, it } from "vitest";
import { buildWallSegments, floorArea, isOutdoorRoom, wallLength } from "../geometry";
import { planSchema } from "../schema";
import { HOUSE_TEMPLATES, buildPlanFromSpec } from "../templates";

describe.each(HOUSE_TEMPLATES.map((template) => [template.key, template] as const))("template %s", (_key, template) => {
  const plan = buildPlanFromSpec(template);

  it("is a valid plan with unique ids and the announced lot", () => {
    const result = planSchema.safeParse(plan);
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues.slice(0, 3))).toBe(true);
    const ids = [
      plan.id,
      ...plan.materials.map((material) => material.id),
      ...plan.floors.flatMap((floor) => [
        floor.id,
        ...floor.rooms.map((room) => room.id),
        ...floor.walls.map((wall) => wall.id),
        ...floor.doors.map((door) => door.id),
        ...floor.windows.map((window) => window.id),
        ...floor.furniture.map((item) => item.id),
      ]),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan.lot.width * plan.lot.depth).toBe(template.lot.width * template.lot.depth);
  });

  it("tiles each level's footprint exactly with its indoor rooms", () => {
    template.floors.forEach((spec, index) => {
      const floor = plan.floors[index];
      const indoor = { ...floor, rooms: floor.rooms.filter((room) => !isOutdoorRoom(room)) };
      expect(floorArea(indoor), spec.name).toBeCloseTo(spec.footprint.width * spec.footprint.depth, 6);
      for (const room of indoor.rooms) {
        expect(room.x, room.name).toBeGreaterThanOrEqual(template.houseOffset.x - 1e-6);
        expect(room.y, room.name).toBeGreaterThanOrEqual(template.houseOffset.y - 1e-6);
        expect(room.x + room.width, room.name).toBeLessThanOrEqual(template.houseOffset.x + spec.footprint.width + 1e-6);
        expect(room.y + room.depth, room.name).toBeLessThanOrEqual(template.houseOffset.y + spec.footprint.depth + 1e-6);
      }
      // Indoor rooms never overlap each other.
      for (let a = 0; a < indoor.rooms.length; a += 1) {
        for (let b = a + 1; b < indoor.rooms.length; b += 1) {
          const first = indoor.rooms[a];
          const second = indoor.rooms[b];
          const overlapX = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
          const overlapY = Math.min(first.y + first.depth, second.y + second.depth) - Math.max(first.y, second.y);
          expect(overlapX <= 1e-6 || overlapY <= 1e-6, `${first.name} / ${second.name}`).toBe(true);
        }
      }
    });
  });

  it("keeps every opening inside its wall and attached after merging", () => {
    for (const floor of plan.floors) {
      const walls = new Map(floor.walls.map((wall) => [wall.id, wall]));
      for (const opening of [...floor.doors, ...floor.windows]) {
        const wall = walls.get(opening.wallId);
        expect(wall, opening.id).toBeDefined();
        if (!wall) continue;
        expect(opening.offset - opening.width / 2, opening.id).toBeGreaterThanOrEqual(-1e-6);
        expect(opening.offset + opening.width / 2, opening.id).toBeLessThanOrEqual(wallLength(wall) + 1e-6);
      }
      const attached = buildWallSegments(floor).flatMap((segment) => segment.openings.map((opening) => opening.id));
      expect(attached, floor.name).toHaveLength(floor.doors.length + floor.windows.length);
    }
  });

  it("places every piece of furniture inside a room and stays within the lot", () => {
    for (const floor of plan.floors) {
      for (const item of floor.furniture) {
        const inside = floor.rooms.some(
          (room) => item.x > room.x && item.x < room.x + room.width && item.y > room.y && item.y < room.y + room.depth,
        );
        expect(inside, `${floor.name} / ${item.id}`).toBe(true);
      }
      for (const room of floor.rooms) {
        expect(room.x, room.name).toBeGreaterThanOrEqual(0);
        expect(room.y, room.name).toBeGreaterThanOrEqual(0);
        expect(room.x + room.width, room.name).toBeLessThanOrEqual(plan.lot.width);
        expect(room.y + room.depth, room.name).toBeLessThanOrEqual(plan.lot.depth);
      }
    }
  });

  it("has at least one bedroom, one bathroom and a living room", () => {
    const types = plan.floors.flatMap((floor) => floor.rooms.map((room) => room.type));
    expect(types).toContain("bedroom");
    expect(types).toContain("bathroom");
    expect(types).toContain("living");
  });
});
