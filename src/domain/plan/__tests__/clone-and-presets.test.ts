import { describe, expect, it } from "vitest";
import { clonePlan } from "../clone";
import { buildDemoPlan } from "../demo";
import { planSchema } from "../schema";
import { applyStylePreset } from "../style-presets";
import { formatPlanStats, planStats } from "../preview";

const collectIds = (plan: ReturnType<typeof buildDemoPlan>) => [
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

describe("clonePlan", () => {
  it("renews every id and keeps references consistent", () => {
    const source = buildDemoPlan();
    const copy = clonePlan(source, { name: "Copie" });
    expect(planSchema.safeParse(copy).success).toBe(true);
    const sourceIds = new Set(collectIds(source));
    const copyIds = collectIds(copy);
    expect(copyIds.some((id) => sourceIds.has(id))).toBe(false);
    expect(new Set(copyIds).size).toBe(copyIds.length);
    expect(copy.slug).toBeNull();
    expect(copy.name).toBe("Copie");

    const [floor] = copy.floors;
    const wallIds = new Set(floor.walls.map((wall) => wall.id));
    const roomIds = new Set(floor.rooms.map((room) => room.id));
    const materialIds = new Set(copy.materials.map((material) => material.id));
    expect(floor.doors.every((door) => wallIds.has(door.wallId))).toBe(true);
    expect(floor.windows.every((window) => wallIds.has(window.wallId))).toBe(true);
    expect(floor.walls.every((wall) => wall.roomId === null || roomIds.has(wall.roomId))).toBe(true);
    expect(floor.rooms.every((room) => room.floorMaterialId === null || materialIds.has(room.floorMaterialId))).toBe(true);
    expect(materialIds.has(copy.settings.roofMaterialId ?? "")).toBe(true);
  });
});

describe("applyStylePreset", () => {
  it("switches roof, façade and floors, creating missing materials", () => {
    const plan = { ...buildDemoPlan(), materials: [] };
    const styled = applyStylePreset(plan, "modern");
    expect(styled.settings.roofType).toBe("flat");
    const facade = styled.materials.find((material) => material.id === styled.settings.exteriorMaterialId);
    expect(facade?.name).toBe("Enduit blanc");
    const floorIds = new Set(styled.floors[0].rooms.map((room) => room.floorMaterialId));
    expect(floorIds.size).toBe(1);
    expect(styled.materials.find((material) => material.id === [...floorIds][0])?.name).toBe("Béton ciré");
    expect(planSchema.safeParse(styled).success).toBe(true);
  });

  it("reuses existing materials instead of duplicating them", () => {
    const plan = buildDemoPlan();
    const styled = applyStylePreset(plan, "classic");
    expect(styled.materials).toHaveLength(plan.materials.length);
  });
});

describe("planStats", () => {
  it("summarises the demo house", () => {
    const stats = planStats(buildDemoPlan());
    expect(stats.bedrooms).toBe(3);
    expect(stats.bathrooms).toBe(2);
    expect(formatPlanStats(stats)).toBe("3 chambres · 2 salles de bain · 1 garage · Terrain : 300 m²");
  });
});
