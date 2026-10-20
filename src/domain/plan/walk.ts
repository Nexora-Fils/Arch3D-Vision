import { buildSolidSegments, buildWallSegments, floorBaseHeight, resolveCollisions, vecAdd, vecScale, type SolidSegment } from "./geometry";
import type { Plan, Vec2 } from "./schema";
import { buildStairFlights, isOnStair, locateOnStair, lowerStairSolids, stairElevation, stairSideSolids, upperStairSolids, type StairFlight } from "./stairs";

/** Everything the walkthrough needs to move a visitor across levels. */
export interface WalkWorld {
  flights: StairFlight[];
  /** Walls of each floor (doors excluded). */
  walls: SolidSegment[][];
  /** Walls of each floor plus the guards around its stairs and stairwells. */
  obstacles: SolidSegment[][];
  bases: number[];
}

export interface VisitorState {
  position: Vec2;
  /** Floor the visitor stands on (the lower floor while on a stair). */
  floorIndex: number;
  flightId: string | null;
  /** Piece of the stair the visitor stands on (flight or landing). */
  pieceIndex?: number;
}

export const createWalkWorld = (plan: Plan): WalkWorld => {
  const flights = buildStairFlights(plan);
  const walls = plan.floors.map((floor) => buildSolidSegments(buildWallSegments(floor)));
  return {
    flights,
    walls,
    obstacles: walls.map((floorWalls, index) => [
      ...floorWalls,
      ...flights.filter((flight) => flight.lowerIndex === index).flatMap(lowerStairSolids),
      ...flights.filter((flight) => flight.upperIndex === index).flatMap(upperStairSolids),
    ]),
    bases: plan.floors.map((_, index) => floorBaseHeight(plan, index)),
  };
};

const findFlight = (world: WalkWorld, id: string | null) => (id ? world.flights.find((flight) => flight.id === id) : undefined);

/** Distance kept between a spawn point moved off the stairs and the stair (m). */
const SPAWN_CLEARANCE = 0.6;

/**
 * Places the visitor on a floor, off the stairs: a point inside a stairwell
 * (upper floor) or on the steps (lower floor) moves to the arrival or to the
 * foot of the stair, so a teleport never drops the visitor mid-flight.
 */
export const spawnVisitor = (world: WalkWorld, floorIndex: number, point: Vec2): VisitorState => {
  const flight = world.flights.find((candidate) => (candidate.lowerIndex === floorIndex || candidate.upperIndex === floorIndex) && isOnStair(candidate, point));
  if (!flight) return { position: point, floorIndex, flightId: null };
  const position =
    flight.upperIndex === floorIndex
      ? vecAdd(flight.exit.center, vecScale(flight.exit.direction, SPAWN_CLEARANCE))
      : vecAdd(flight.entry.center, vecScale(flight.entry.direction, -SPAWN_CLEARANCE));
  return { position, floorIndex, flightId: null };
};

/**
 * Moves the visitor towards `target` (collisions included) and handles the
 * stairs: stepping on from the entry edge (lower floor) or the exit edge
 * (upper floor), following flights and landings, and leaving at either end
 * on the matching floor.
 */
export const moveVisitor = (world: WalkWorld, state: VisitorState, target: Vec2, radius: number): VisitorState => {
  const flight = findFlight(world, state.flightId);
  if (flight) {
    const isHigh = stairElevation(flight, state.position, state.pieceIndex) >= flight.rise / 2;
    const walls = world.walls[isHigh ? flight.upperIndex : flight.lowerIndex];
    const position = resolveCollisions(target, [...stairSideSolids(flight), ...walls], radius);
    const location = locateOnStair(flight, position);
    if (location.kind === "above") return { position, floorIndex: flight.upperIndex, flightId: null };
    if (location.kind === "below") return { position, floorIndex: flight.lowerIndex, flightId: null };
    return { position, floorIndex: flight.lowerIndex, flightId: flight.id, pieceIndex: location.kind === "piece" ? location.index : state.pieceIndex };
  }

  const position = resolveCollisions(target, world.obstacles[state.floorIndex] ?? [], radius);
  for (const candidate of world.flights) {
    if (candidate.lowerIndex !== state.floorIndex && candidate.upperIndex !== state.floorIndex) continue;
    const location = locateOnStair(candidate, position);
    if (location.kind === "piece") return { position, floorIndex: candidate.lowerIndex, flightId: candidate.id, pieceIndex: location.index };
  }
  return { position, floorIndex: state.floorIndex, flightId: null };
};

/** Height of the ground under the visitor's feet. */
export const visitorElevation = (world: WalkWorld, state: VisitorState): number => {
  const flight = findFlight(world, state.flightId);
  if (flight) return world.bases[flight.lowerIndex] + stairElevation(flight, state.position, state.pieceIndex);
  return world.bases[state.floorIndex] ?? 0;
};

/** Floor shown in the interface: on a stair, whichever level is closer. */
export const visibleFloorIndex = (world: WalkWorld, state: VisitorState): number => {
  const flight = findFlight(world, state.flightId);
  if (!flight) return state.floorIndex;
  return stairElevation(flight, state.position, state.pieceIndex) >= flight.rise / 2 ? flight.upperIndex : flight.lowerIndex;
};
