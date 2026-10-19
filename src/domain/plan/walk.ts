import { buildSolidSegments, buildWallSegments, floorBaseHeight, resolveCollisions, vecAdd, vecScale, type SolidSegment } from "./geometry";
import type { Plan, Vec2 } from "./schema";
import {
  buildStairFlights,
  flightElevation,
  flightProgress,
  flightSideSolids,
  isOnFlight,
  lowerFlightSolids,
  upperFlightSolids,
  type StairFlight,
} from "./stairs";

/** Everything the walkthrough needs to move a visitor across levels. */
export interface WalkWorld {
  flights: StairFlight[];
  /** Walls of each floor (doors excluded). */
  walls: SolidSegment[][];
  /** Walls of each floor plus the guards around its flights and stairwells. */
  obstacles: SolidSegment[][];
  bases: number[];
}

export interface VisitorState {
  position: Vec2;
  /** Floor the visitor stands on (the lower floor while on a flight). */
  floorIndex: number;
  flightId: string | null;
}

export const createWalkWorld = (plan: Plan): WalkWorld => {
  const flights = buildStairFlights(plan);
  const walls = plan.floors.map((floor) => buildSolidSegments(buildWallSegments(floor)));
  return {
    flights,
    walls,
    obstacles: walls.map((floorWalls, index) => [
      ...floorWalls,
      ...flights.filter((flight) => flight.lowerIndex === index).flatMap(lowerFlightSolids),
      ...flights.filter((flight) => flight.upperIndex === index).flatMap(upperFlightSolids),
    ]),
    bases: plan.floors.map((_, index) => floorBaseHeight(plan, index)),
  };
};

const findFlight = (world: WalkWorld, id: string | null) => (id ? world.flights.find((flight) => flight.id === id) : undefined);

/**
 * Moves the visitor towards `target` (collisions included) and handles the
 * stairs: stepping on a flight from its bottom edge (lower floor) or its top
 * edge (upper floor), and leaving it at either end on the matching floor.
 */
/** Distance kept between a spawn point moved off the stairs and the flight. */
const SPAWN_CLEARANCE = 0.6;

/**
 * Places the visitor on a floor, off the stairs: a point inside a stairwell
 * (upper floor) or on the steps (lower floor) moves to the arrival or to the
 * foot of the flight, so a teleport never drops the visitor mid-flight.
 */
export const spawnVisitor = (world: WalkWorld, floorIndex: number, point: Vec2): VisitorState => {
  const flight = world.flights.find(
    (candidate) => (candidate.lowerIndex === floorIndex || candidate.upperIndex === floorIndex) && isOnFlight(candidate, point),
  );
  if (!flight) return { position: point, floorIndex, flightId: null };
  const along = flight.upperIndex === floorIndex ? flight.run + SPAWN_CLEARANCE : -SPAWN_CLEARANCE;
  return { position: vecAdd(flight.bottom, vecScale(flight.direction, along)), floorIndex, flightId: null };
};

export const moveVisitor = (world: WalkWorld, state: VisitorState, target: Vec2, radius: number): VisitorState => {
  const flight = findFlight(world, state.flightId);
  let position: Vec2;
  if (flight) {
    const t = flightProgress(flight, target);
    const walls = world.walls[t < 0.5 ? flight.lowerIndex : flight.upperIndex];
    position = resolveCollisions(target, [...flightSideSolids(flight), ...walls], radius);
  } else {
    position = resolveCollisions(target, world.obstacles[state.floorIndex] ?? [], radius);
  }

  if (flight) {
    const t = flightProgress(flight, position);
    if (t >= 1) return { position, floorIndex: flight.upperIndex, flightId: null };
    if (t <= 0) return { position, floorIndex: flight.lowerIndex, flightId: null };
    return { position, floorIndex: flight.lowerIndex, flightId: flight.id };
  }

  const entered = world.flights.find(
    (candidate) => (candidate.lowerIndex === state.floorIndex || candidate.upperIndex === state.floorIndex) && isOnFlight(candidate, position),
  );
  if (entered) return { position, floorIndex: entered.lowerIndex, flightId: entered.id };
  return { position, floorIndex: state.floorIndex, flightId: null };
};

/** Height of the ground under the visitor's feet. */
export const visitorElevation = (world: WalkWorld, state: VisitorState): number => {
  const flight = findFlight(world, state.flightId);
  if (flight) return world.bases[flight.lowerIndex] + flightElevation(flight, state.position);
  return world.bases[state.floorIndex] ?? 0;
};

/** Floor shown in the interface: on a flight, whichever level is closer. */
export const visibleFloorIndex = (world: WalkWorld, state: VisitorState): number => {
  const flight = findFlight(world, state.flightId);
  if (!flight) return state.floorIndex;
  return flightProgress(flight, state.position) >= 0.5 ? flight.upperIndex : flight.lowerIndex;
};
