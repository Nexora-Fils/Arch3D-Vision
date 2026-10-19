import { describe, expect, it } from "vitest";
import { buildDemoPlan } from "../demo";
import { createRoomWalls, LEVEL_SLAB_THICKNESS, type Bounds } from "../geometry";
import type { Floor, Furniture, Plan, Room } from "../schema";
import { buildStairFlights, checkStairs, flightProgress, stairIssues, subtractRect, subtractRects } from "../stairs";
import { HOUSE_TEMPLATES, buildPlanFromSpec } from "../templates";
import { createWalkWorld, moveVisitor, spawnVisitor, visibleFloorIndex, visitorElevation, type VisitorState } from "../walk";

let counter = 0;
const nextId = () => `id-${(counter += 1)}`;

const room = (id: string): Room => ({ id, name: id, type: "hallway", x: 0, y: 0, width: 6, depth: 6, polygon: null, floorMaterialId: null });

const floor = (id: string, level: number, furniture: Furniture[] = []): Floor => {
  const hall = room(`${id}-hall`);
  return {
    id,
    name: level === 0 ? "Rez-de-chaussée" : "Étage",
    level,
    height: 2.7,
    rooms: [hall],
    walls: createRoomWalls(hall, { thickness: 0.2, height: 2.7, materialId: null }, nextId),
    doors: [],
    windows: [],
    furniture,
    annotations: [],
  };
};

/** Straight flight in the middle of a 6 × 6 hall, climbing north from y = 4.7 to y = 1.3. */
const stairs: Furniture = { id: "stairs", type: "stairs", x: 3, y: 3, rotation: 0, width: 1, depth: 3.4, height: 2.7, color: "#999999" };

const twoLevels = (): Plan => {
  const demo = buildDemoPlan();
  return { ...demo, lot: { width: 6, depth: 6 }, floors: [floor("rdc", 0, [stairs]), floor("etage", 1)] };
};

/** Walks the visitor towards `target` in small steps from wherever it stands, as the walkthrough does every frame. */
const walk = (plan: Plan, from: VisitorState, target: { x: number; y: number }, steps = 120): VisitorState[] => {
  const world = createWalkWorld(plan);
  const step = { x: (target.x - from.position.x) / steps, y: (target.y - from.position.y) / steps };
  const states: VisitorState[] = [];
  let state = from;
  for (let index = 0; index < steps; index += 1) {
    state = moveVisitor(world, state, { x: state.position.x + step.x, y: state.position.y + step.y }, 0.28);
    states.push(state);
  }
  return states;
};

describe("stair flights", () => {
  it("rise up to the finished floor of the level above", () => {
    const [flight] = buildStairFlights(twoLevels());
    expect(flight.rise).toBeCloseTo(2.7 + LEVEL_SLAB_THICKNESS, 6);
    expect(flight.bottom).toEqual({ x: 3, y: 4.7 });
    expect(flight.opening).toEqual({ minX: 2.5, minY: 1.3, maxX: 3.5, maxY: 4.7 });
    expect(flightProgress(flight, { x: 3, y: 1.3 })).toBeCloseTo(1, 6);
  });

  it("are not created on the top floor", () => {
    const plan = twoLevels();
    plan.floors[1].furniture = [{ ...stairs, id: "attic" }];
    expect(buildStairFlights(plan).map((flight) => flight.id)).toEqual(["stairs"]);
    expect(checkStairs(plan, 1, plan.floors[1].furniture[0]).issues[0]).toMatch(/ne mène nulle part/);
  });
});

describe("climbing", () => {
  it("takes the visitor from the ground floor to the upper floor and back", () => {
    const plan = twoLevels();
    const world = createWalkWorld(plan);
    const up = walk(plan, { position: { x: 3, y: 5.5 }, floorIndex: 0, flightId: null }, { x: 3, y: 0.6 });
    const elevations = up.map((state) => visitorElevation(world, state));
    for (let index = 1; index < elevations.length; index += 1) expect(elevations[index]).toBeGreaterThanOrEqual(elevations[index - 1] - 1e-9);
    const end = up[up.length - 1];
    expect(end.floorIndex).toBe(1);
    expect(end.flightId).toBeNull();
    expect(visitorElevation(world, end)).toBeCloseTo(2.95, 6);
    expect(up.some((state) => state.flightId === "stairs" && visibleFloorIndex(world, state) === 0)).toBe(true);

    const down = walk(plan, end, { x: 3, y: 5.5 });
    const last = down[down.length - 1];
    expect(last.floorIndex).toBe(0);
    expect(visitorElevation(world, last)).toBe(0);
  });

  it("cannot step into the stairwell from its sides upstairs", () => {
    const states = walk(twoLevels(), { position: { x: 1.2, y: 3 }, floorIndex: 1, flightId: null }, { x: 3, y: 3 });
    const end = states[states.length - 1];
    expect(end.flightId).toBeNull();
    expect(end.floorIndex).toBe(1);
    expect(end.position.x).toBeLessThan(2.5 - 0.28);
  });

  it("cannot walk under the high end of the flight downstairs", () => {
    const states = walk(twoLevels(), { position: { x: 3, y: 0.6 }, floorIndex: 0, flightId: null }, { x: 3, y: 2.5 });
    const end = states[states.length - 1];
    expect(end.flightId).toBeNull();
    expect(end.position.y).toBeLessThan(1.3 - 0.28);
  });

  it("never spawns the visitor on the stairs (minimap teleport to a room centered on the stairwell)", () => {
    const world = createWalkWorld(twoLevels());
    const upstairs = spawnVisitor(world, 1, { x: 3, y: 3 });
    expect(upstairs).toMatchObject({ floorIndex: 1, flightId: null });
    expect(upstairs.position.y).toBeCloseTo(0.7);
    const downstairs = spawnVisitor(world, 0, { x: 3, y: 3 });
    expect(downstairs).toMatchObject({ floorIndex: 0, flightId: null });
    expect(downstairs.position.y).toBeCloseTo(5.3);
    expect(spawnVisitor(world, 1, { x: 1, y: 1 }).position).toEqual({ x: 1, y: 1 });
  });
});

describe("stairs checks", () => {
  it("reports the original demo bug: stairs ending against the façade, under the bathroom", () => {
    const plan = buildDemoPlan();
    const ground = plan.floors[0];
    const buggy: Furniture = { id: "old-stairs", type: "stairs", x: 5 + 6.4, y: 1.5 + 1.4, rotation: 0, width: 0.9, depth: 2.4, height: 2.7, color: "#9ca3af" };
    plan.floors[0] = { ...ground, furniture: [...ground.furniture.filter((item) => item.type !== "stairs"), buggy] };
    expect(checkStairs(plan, 0, buggy).issues.length).toBeGreaterThan(0);
  });

  it.each(HOUSE_TEMPLATES.map((template) => [template.key, template] as const))("finds no stairs issue in the « %s » template", (_key, template) => {
    const plan = buildPlanFromSpec(template);
    expect(Object.fromEntries(stairIssues(plan))).toEqual({});
    const multiLevel = plan.floors.length > 1;
    expect(buildStairFlights(plan).length > 0).toBe(multiLevel);
    for (const flight of buildStairFlights(plan)) {
      const check = checkStairs(plan, flight.lowerIndex, flight.item);
      const arrival = plan.floors[flight.upperIndex].rooms.find((item) => item.name === check.arrivalRoom);
      expect(arrival?.type, template.key).toBe("hallway");
    }
  });
});

describe("subtractRect", () => {
  const rect: Bounds = { minX: 0, minY: 0, maxX: 4, maxY: 4 };

  it("keeps the rectangle when the hole is elsewhere", () => {
    expect(subtractRect(rect, { minX: 5, minY: 5, maxX: 6, maxY: 6 })).toEqual([rect]);
  });

  it("leaves four pieces around an inner hole, with the right total area", () => {
    const pieces = subtractRect(rect, { minX: 1, minY: 1, maxX: 2, maxY: 3 });
    expect(pieces).toHaveLength(4);
    const area = pieces.reduce((sum, piece) => sum + (piece.maxX - piece.minX) * (piece.maxY - piece.minY), 0);
    expect(area).toBeCloseTo(16 - 2, 6);
  });

  it("handles several holes and a hole touching an edge", () => {
    const pieces = subtractRects(rect, [
      { minX: 0, minY: 0, maxX: 1, maxY: 4 },
      { minX: 3, minY: 1, maxX: 4, maxY: 2 },
    ]);
    const area = pieces.reduce((sum, piece) => sum + (piece.maxX - piece.minX) * (piece.maxY - piece.minY), 0);
    expect(area).toBeCloseTo(16 - 4 - 1, 6);
  });
});
