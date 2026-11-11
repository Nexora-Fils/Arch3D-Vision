import { beforeEach, describe, expect, it } from "vitest";
import { createRoomWalls } from "@/domain/plan/geometry";
import type { Floor, Plan, Room, Wall } from "@/domain/plan/schema";
import { usePlanStore } from "../plan-store";

const groundRoom: Room = {
  id: "ground-room",
  name: "Séjour",
  type: "living",
  x: 0,
  y: 0,
  width: 5,
  depth: 4,
  polygon: null,
  floorMaterialId: null,
};

let wallId = 0;
const groundFloor: Floor = {
  id: "ground-floor",
  name: "RDC",
  level: 0,
  height: 2.7,
  rooms: [groundRoom],
  walls: [
    ...createRoomWalls(groundRoom, { thickness: 0.2, height: 2.7, materialId: null }, () => `exterior-${(wallId += 1)}`),
    {
      id: "interior",
      roomId: null,
      side: null,
      start: { x: 1, y: 1 },
      end: { x: 4, y: 1 },
      thickness: 0.15,
      height: 2.7,
      materialId: null,
    } satisfies Wall,
  ],
  doors: [],
  windows: [],
  furniture: [],
  annotations: [],
};

const plan: Plan = {
  id: "plan",
  name: "Maison",
  description: null,
  slug: null,
  lot: { width: 20, depth: 15 },
  settings: {
    roofType: "flat",
    roofPitch: 30,
    roofOverhang: 0.3,
    roofMaterialId: null,
    exteriorMaterialId: null,
    defaultWallHeight: 2.7,
    defaultWallThickness: 0.2,
    solarPanels: false,
    shutters: false,
    frameColor: "#2b2f36",
  },
  materials: [],
  floors: [groundFloor],
};

describe("addFloor", () => {
  beforeEach(() => usePlanStore.getState().load(plan));

  it("copies only ground-floor exterior walls when requested", () => {
    const added = usePlanStore.getState().addFloor(true);

    expect(added?.walls).toHaveLength(4);
    expect(added?.walls.every((wall) => wall.roomId === null && wall.side === null)).toBe(true);
    expect(added?.walls.every((wall) => !groundFloor.walls.some((source) => source.id === wall.id))).toBe(true);
  });

  it("keeps the new floor empty when exterior-wall reuse is disabled", () => {
    expect(usePlanStore.getState().addFloor()?.walls).toEqual([]);
  });
});
