"use client";

import { useEffect, useMemo } from "react";
import type { MeshStandardMaterial } from "three";
import type { SolidSegment } from "@/domain/plan/geometry";
import type { Furniture, Lot, Vec2 } from "@/domain/plan/schema";
import { buildStairShape, distanceToWalls, edgeElevation, type LocalVec, type StairEdge, type StairFlight, type StairPiece, type StairShape } from "@/domain/plan/stairs";
import { useMergedBoxes, type BoxPart } from "@/features/viewer-3d/architecture/merged-boxes";
import { AlongSegment, MetricBox } from "@/features/viewer-3d/architecture/parts";
import { toScene } from "@/features/viewer-3d/convert";
import { createPhotoMaterial, type SceneMaterials } from "@/features/viewer-3d/scene-materials";

const RAIL_HEIGHT = 0.9;
const TREAD_THICKNESS = 0.04;
/** Handrails stand this far inside the edge of the stair (m). */
const RAIL_INSET = 0.035;
const BALUSTER_SPACING = 0.4;
/** Distance from a wall below which a stair side or a stairwell edge needs no handrail (m). */
const HANDRAIL_WALL_CLEARANCE = 0.25;

type Triple = [number, number, number];

/** Item frame (a to the right, c up the first flight) to the stair group's local scene frame (x = a, z = -c). */
const local3 = (point: LocalVec, height: number): Triple => [point.a, height, -point.c];

const pieceStart = (piece: StairPiece): LocalVec => {
  const center = { a: (piece.rect.minA + piece.rect.maxA) / 2, c: (piece.rect.minC + piece.rect.maxC) / 2 };
  return { a: center.a - (piece.axis.a * piece.length) / 2, c: center.c - (piece.axis.c * piece.length) / 2 };
};

/** Box covering [from, to] along a piece's axis, full width, between two heights (item frame, scene axes). */
const stepBox = (piece: StairPiece, from: number, to: number, bottom: number, top: number): BoxPart => {
  const start = pieceStart(piece);
  const middle = { a: start.a + (piece.axis.a * (from + to)) / 2, c: start.c + (piece.axis.c * (from + to)) / 2 };
  const along = to - from;
  const alongC = piece.axis.c !== 0;
  return {
    size: alongC ? [piece.width, top - bottom, along] : [along, top - bottom, piece.width],
    position: local3(middle, (bottom + top) / 2),
  };
};

/** Solid bodies (painted) and oak treads of every step and landing. */
const stairParts = (stair: StairShape): { bodies: BoxPart[]; treads: BoxPart[] } => {
  const bodies: BoxPart[] = [];
  const treads: BoxPart[] = [];
  for (const piece of stair.pieces) {
    if (piece.kind === "landing") {
      bodies.push(stepBox(piece, 0, piece.length, 0, piece.fromHeight - TREAD_THICKNESS));
      treads.push(stepBox(piece, -0.01, piece.length + 0.01, piece.fromHeight - TREAD_THICKNESS, piece.fromHeight));
      continue;
    }
    const tread = piece.length / piece.steps;
    for (let index = 0; index < piece.steps; index += 1) {
      const top = piece.fromHeight + stair.riser * (index + 1);
      bodies.push(stepBox(piece, tread * index, tread * (index + 1), 0, top - TREAD_THICKNESS));
      // Slight nosing over the step below.
      treads.push(stepBox(piece, tread * index - 0.02, tread * (index + 1), top - TREAD_THICKNESS, top));
    }
  }
  return { bodies, treads };
};

interface Rail {
  start: Triple;
  end: Triple;
}

/** Handrail and balusters along one outline edge, set inside the stair and following its slope. */
const railFor = (stair: StairShape, edge: StairEdge): { rail: Rail; balusters: BoxPart[] } => {
  const piece = stair.pieces[edge.piece];
  const center = { a: (piece.rect.minA + piece.rect.maxA) / 2, c: (piece.rect.minC + piece.rect.maxC) / 2 };
  const length = Math.hypot(edge.localEnd.a - edge.localStart.a, edge.localEnd.c - edge.localStart.c);
  const direction = { a: (edge.localEnd.a - edge.localStart.a) / length, c: (edge.localEnd.c - edge.localStart.c) / length };
  let inward = { a: -direction.c, c: direction.a };
  if ((center.a - edge.localStart.a) * inward.a + (center.c - edge.localStart.c) * inward.c < 0) inward = { a: -inward.a, c: -inward.c };
  const at = (t: number) => {
    const local = { a: edge.localStart.a + direction.a * length * t + inward.a * RAIL_INSET, c: edge.localStart.c + direction.c * length * t + inward.c * RAIL_INSET };
    const plan = { x: edge.start.x + (edge.end.x - edge.start.x) * t, y: edge.start.y + (edge.end.y - edge.start.y) * t };
    return { local, height: edgeElevation(stair, edge, plan) };
  };
  const from = at(0);
  const to = at(1);
  const count = Math.max(2, Math.ceil(length / BALUSTER_SPACING) + 1);
  const balusters = Array.from({ length: count }, (_, index) => {
    const point = at(index / (count - 1));
    return { size: [0.022, RAIL_HEIGHT, 0.022], position: local3(point.local, point.height + RAIL_HEIGHT / 2) } satisfies BoxPart;
  });
  return { rail: { start: local3(from.local, from.height + RAIL_HEIGHT), end: local3(to.local, to.height + RAIL_HEIGHT) }, balusters };
};

interface StairMeshProps {
  stair: StairShape;
  /** Elevation of the floor the stair stands on. */
  base: number;
  lot: Lot;
  materials: SceneMaterials;
  /** Outline edges that get a handrail (sides away from walls). */
  railEdges: StairEdge[];
}

/**
 * A stair of any model: painted solid bodies with oak treads, landings, and
 * a sloped handrail with balusters on every open side.
 */
export const StairMesh = ({ stair, base, lot, materials, railEdges }: StairMeshProps) => {
  const { item } = stair;
  const oak = useMemo(() => createPhotoMaterial(materials.photos.laminate, "#b07a4a", 0.6), [materials.photos.laminate]);
  useEffect(() => () => oak.dispose(), [oak]);
  const parts = useMemo(() => stairParts(stair), [stair]);
  const rails = useMemo(() => railEdges.map((edge) => railFor(stair, edge)), [stair, railEdges]);
  const balusterParts = useMemo(() => rails.flatMap((rail) => rail.balusters), [rails]);
  const bodies = useMergedBoxes(parts.bodies);
  const treads = useMergedBoxes(parts.treads);
  const balusters = useMergedBoxes(balusterParts);
  const [x, z] = toScene({ x: item.x, y: item.y }, lot);
  return (
    <group position={[x, base, z]} rotation-y={(-item.rotation * Math.PI) / 180}>
      {bodies ? <mesh geometry={bodies} material={materials.trim} castShadow receiveShadow /> : null}
      {treads ? <mesh geometry={treads} material={oak} castShadow receiveShadow /> : null}
      {balusters ? <mesh geometry={balusters} material={materials.frame} castShadow /> : null}
      {rails.map(({ rail }, index) => (
        <AlongSegment key={index} segment={rail}>
          <MetricBox size={[Math.hypot(rail.end[0] - rail.start[0], rail.end[1] - rail.start[1], rail.end[2] - rail.start[2]) + 0.05, 0.045, 0.045]} material={materials.frame} castShadow />
        </AlongSegment>
      ))}
    </group>
  );
};

const edgeMiddle = (edge: StairEdge): Vec2 => ({ x: (edge.start.x + edge.end.x) / 2, y: (edge.start.y + edge.end.y) / 2 });

interface StairModelProps {
  item: Furniture;
  /** The stair connecting this floor to the next one, or null on the top floor. */
  flight: StairFlight | null;
  walls: SolidSegment[];
  base: number;
  lot: Lot;
  materials: SceneMaterials;
}

/** A stairs item: the real stair up to the next level, or a short decorative one on the top floor. */
export const StairModel = ({ item, flight, walls, base, lot, materials }: StairModelProps) => {
  const stair = useMemo(() => flight ?? buildStairShape(item, item.height), [flight, item]);
  const railEdges = useMemo(
    () => (flight ? flight.edges.filter((edge) => edge.role === "side" && distanceToWalls(walls, edgeMiddle(edge)) > HANDRAIL_WALL_CLEARANCE) : []),
    [flight, walls],
  );
  return <StairMesh stair={stair} base={base} lot={lot} materials={materials} railEdges={railEdges} />;
};

/** Glass guards around a stairwell, on every edge except the arrival and the edges along a wall. */
export const StairwellGuards = ({ flight, walls, top, lot, materials }: { flight: StairFlight; walls: SolidSegment[]; top: number; lot: Lot; materials: SceneMaterials }) => {
  const edges = useMemo(
    () => flight.footprintEdges.filter((edge) => edge.role !== "exit" && distanceToWalls(walls, edgeMiddle(edge)) > HANDRAIL_WALL_CLEARANCE),
    [flight, walls],
  );
  return (
    <group>
      {edges.map((edge, index) => (
        <GuardRail key={index} start={edge.start} end={edge.end} top={top} lot={lot} materials={materials} />
      ))}
    </group>
  );
};

interface GuardRailProps {
  start: Vec2;
  end: Vec2;
  /** Elevation of the floor the rail stands on. */
  top: number;
  lot: Lot;
  materials: SceneMaterials;
  glass?: MeshStandardMaterial;
}

/** Glass guard rail with a metal handrail and posts (terraces, stairwells). */
export const GuardRail = ({ start, end, top, lot, materials, glass = materials.railGlass }: GuardRailProps) => {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const [x, z] = toScene({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, lot);
  const posts = Math.max(2, Math.round(length / 1.2) + 1);
  return (
    <group position={[x, top, z]} rotation-y={-angle}>
      <mesh position-y={1.02} material={materials.frame} castShadow>
        <boxGeometry args={[length, 0.04, 0.05]} />
      </mesh>
      <mesh position-y={0.55} material={glass}>
        <boxGeometry args={[length - 0.06, 0.9, 0.012]} />
      </mesh>
      {Array.from({ length: posts }, (_, post) => (
        <mesh key={post} position={[-length / 2 + (length * post) / (posts - 1), 0.5, 0]} material={materials.frame} castShadow>
          <boxGeometry args={[0.04, 1, 0.04]} />
        </mesh>
      ))}
    </group>
  );
};
