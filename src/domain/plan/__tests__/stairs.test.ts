import { describe, expect, it } from "vitest";
import { buildDemoPlan } from "../demo";
import { createRoomWalls, LEVEL_SLAB_THICKNESS, type Bounds } from "../geometry";
import type { Door, Floor, Furniture, Plan, Room, Wall } from "../schema";
import { FURNITURE_PRESETS } from "../labels";
import { buildStairFlights, buildStairShape, checkStairs, STAIR_TYPES, stairIssues, subtractRect, subtractRects, type StairType } from "../stairs";
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

/** A stairs item of the given model at its preset size, in the middle of the 6 × 6 hall. */
const model = (type: StairType): Furniture => ({ ...stairs, id: type, type, width: FURNITURE_PRESETS[type].width, depth: FURNITURE_PRESETS[type].depth });

const withStairs = (item: Furniture): Plan => {
  const plan = twoLevels();
  plan.floors[0] = { ...plan.floors[0], furniture: [item] };
  return plan;
};

/** Walks through a list of waypoints, each leg in small steps. */
const walkPath = (plan: Plan, from: VisitorState, waypoints: { x: number; y: number }[]): VisitorState[] =>
  waypoints.reduce<VisitorState[]>((states, waypoint) => [...states, ...walk(plan, states[states.length - 1] ?? from, waypoint)], []);

describe("stair flights", () => {
  it("rise up to the finished floor of the level above", () => {
    const [flight] = buildStairFlights(twoLevels());
    expect(flight.rise).toBeCloseTo(2.7 + LEVEL_SLAB_THICKNESS, 6);
    expect(flight.entry.center).toEqual({ x: 3, y: 4.7 });
    expect(flight.exit.center.x).toBeCloseTo(3, 6);
    expect(flight.exit.center.y).toBeCloseTo(1.3, 6);
    expect(flight.openings).toEqual([{ minX: 2.5, minY: 1.3, maxX: 3.5, maxY: 4.7 }]);
    expect(flight.pieces[0].toHeight).toBeCloseTo(flight.rise, 6);
  });

  it.each(STAIR_TYPES)("« %s » fits its preset box, climbs with equal risers and reaches the upper floor", (type) => {
    const item = model(type);
    const shape = buildStairShape(item, 2.95);
    const halfW = item.width / 2 + 1e-6;
    const halfD = item.depth / 2 + 1e-6;
    for (const piece of shape.pieces) {
      expect(piece.rect.minA).toBeGreaterThanOrEqual(-halfW);
      expect(piece.rect.maxA).toBeLessThanOrEqual(halfW);
      expect(piece.rect.minC).toBeGreaterThanOrEqual(-halfD);
      expect(piece.rect.maxC).toBeLessThanOrEqual(halfD);
    }
    const flights = shape.pieces.filter((piece) => piece.kind === "flight");
    const landings = shape.pieces.length - flights.length;
    expect(flights.reduce((sum, piece) => sum + piece.steps, 0) + landings).toBe(shape.steps);
    expect(shape.pieces[shape.pieces.length - 1].toHeight).toBeCloseTo(2.95, 6);
    // Turning models get comfortable 24 cm+ treads at their preset size; the straight one keeps its historical 3.4 m (20 cm).
    for (const piece of flights) expect(piece.length / piece.steps).toBeGreaterThan(type === "stairs" ? 0.19 : 0.24);
    expect(checkStairs(withStairs(item), 0, item).issues).toEqual([]);
  });

  it("gives a half-turn stair an open well, closed at the foot and guarded upstairs", () => {
    const shape = buildStairShape(model("stairs_half_turn"), 2.95);
    expect(shape.openings).toHaveLength(4);
    const entries = shape.footprintEdges.filter((edge) => edge.role === "entry");
    const exits = shape.footprintEdges.filter((edge) => edge.role === "exit");
    expect(entries).toHaveLength(1);
    expect(exits).toHaveLength(1);
    // Entry and exit both face the foot of the stair, side by side.
    expect(shape.entry.center.y).toBeCloseTo(shape.exit.center.y, 6);
    expect(shape.exit.direction.y).toBeCloseTo(-shape.entry.direction.y, 6);
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

  it.each([
    ["stairs_quarter_right", [{ x: 2.25, y: 5.6 }, { x: 2.25, y: 1.75 }, { x: 5.3, y: 1.75 }]],
    ["stairs_quarter_left", [{ x: 3.75, y: 5.6 }, { x: 3.75, y: 1.75 }, { x: 0.7, y: 1.75 }]],
    ["stairs_half_turn", [{ x: 2.5, y: 5.6 }, { x: 2.5, y: 1.95 }, { x: 3.5, y: 1.95 }, { x: 3.5, y: 5.5 }]],
  ] as const)("climbs a « %s » stair through its landing and comes back down", (type, waypoints) => {
    const plan = withStairs(model(type));
    const world = createWalkWorld(plan);
    const up = walkPath(plan, { position: waypoints[0], floorIndex: 0, flightId: null }, waypoints.slice(1));
    const elevations = up.map((state) => visitorElevation(world, state));
    for (let index = 1; index < elevations.length; index += 1) expect(elevations[index]).toBeGreaterThanOrEqual(elevations[index - 1] - 1e-9);
    const top = up[up.length - 1];
    expect(top.floorIndex).toBe(1);
    expect(top.flightId).toBeNull();
    expect(visitorElevation(world, top)).toBeCloseTo(2.95, 6);
    // The landing is walked on, at a constant height between the two flights.
    expect(up.some((state) => state.flightId === type && state.pieceIndex === 1)).toBe(true);

    const down = walkPath(plan, top, [...waypoints].reverse().slice(1));
    const bottom = down[down.length - 1];
    expect(bottom.floorIndex).toBe(0);
    expect(visitorElevation(world, bottom)).toBe(0);
  });

  it("cannot walk under the high flight of a half-turn stair downstairs", () => {
    const states = walk(withStairs(model("stairs_half_turn")), { position: { x: 3.5, y: 5.6 }, floorIndex: 0, flightId: null }, { x: 3.5, y: 3 });
    const end = states[states.length - 1];
    expect(end.flightId).toBeNull();
    expect(end.position.y).toBeGreaterThan(4.5 + 0.28 - 0.01);
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
    // Turning stair: a point on the landing upstairs moves past the arrival.
    const turning = createWalkWorld(withStairs(model("stairs_quarter_right")));
    const arrival = spawnVisitor(turning, 1, { x: 2.25, y: 1.75 });
    expect(arrival.position.x).toBeCloseTo(4.2 + 0.6, 6);
    expect(arrival.position.y).toBeCloseTo(1.75, 6);
  });
});

describe("stairs checks", () => {
  it("reports an upper-floor door whose 0.9 m passage crosses the stairwell", () => {
    const plan = withStairs(stairs);
    const upper = plan.floors[1];
    const wall: Wall = {
      id: "blocked-door-wall",
      roomId: upper.rooms[0].id,
      side: null,
      start: { x: 2.5, y: 3 },
      end: { x: 3.5, y: 3 },
      thickness: 0.2,
      height: upper.height,
      materialId: null,
    };
    const door: Door = {
      id: "blocked-door",
      wallId: wall.id,
      offset: 0.5,
      width: 0.9,
      height: 2.1,
      type: "standard",
      swing: "left",
    };
    plan.floors[1] = { ...upper, walls: [wall], doors: [door] };

    expect(checkStairs(plan, 0, stairs).issues.join(" ")).toMatch(/porte.*étage|porte.*trémie/i);
  });

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
