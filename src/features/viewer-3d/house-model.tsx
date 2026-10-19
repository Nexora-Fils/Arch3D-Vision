"use client";

import { useEffect, useMemo } from "react";
import { IcosahedronGeometry, Vector3, type BufferGeometry, type MeshStandardMaterial } from "three";
import {
  buildSolidSegments,
  buildWallSegments,
  floorBounds,
  isOutdoorRoom,
  isPointInRoom,
  roomCenter,
  vecAdd,
  vecScale,
  type Bounds,
  type WallOpening,
  type WallSegment,
} from "@/domain/plan/geometry";
import type { Floor, Lot, Material, Plan, Room } from "@/domain/plan/schema";
import { floorBaseHeight, LEVEL_SLAB_THICKNESS, toScene } from "@/features/viewer-3d/convert";
import { FurnitureMesh } from "@/features/viewer-3d/furniture-mesh";
import { ScannedModel } from "@/features/viewer-3d/scanned-model";
import { buildRoofGeometry } from "@/features/viewer-3d/roof-geometry";
import { pickMaterial, useRoofMaterial, useSceneMaterials, useTiledMaterial, type SceneMaterials } from "@/features/viewer-3d/scene-materials";
import { buildWallGeometry } from "@/features/viewer-3d/wall-geometry";
import type { TimeOfDay } from "@/store/viewer-store";

export type HouseMode = "orbit" | "walk";

interface HouseModelProps {
  plan: Plan;
  showRoof: boolean;
  hiddenFloorIds?: string[];
  mode: HouseMode;
  timeOfDay?: TimeOfDay;
  quality?: "low" | "high";
  /** In walk mode, only this floor gets interior lights (performance). */
  walkFloorId?: string | null;
}

const SLAB_THICKNESS = 0.1;
const FRAME = 0.06;
const BASEBOARD_HEIGHT = 0.08;
const PLINTH_HEIGHT = 0.22;

interface PathRect {
  x: number;
  y: number;
  width: number;
  depth: number;
  /** Wide openings (garage doors) get a gravel driveway. */
  isDriveway: boolean;
  angle: number;
  /** Axis-aligned footprint, used to keep hedges away. */
  bounds: Bounds;
}

/** Concrete paths from every exterior ground-floor door to the lot edge (driveway for the garage). */
const computePaths = (floor: Floor, lot: Lot): PathRect[] => {
  const segments = buildWallSegments(floor);
  const items: PathRect[] = [];
  for (const segment of segments) {
    if (segment.exteriorSide === 0) continue;
    for (const opening of segment.openings) {
      if (opening.kind !== "door") continue;
      const outward = vecScale(segment.normal, segment.exteriorSide);
      const center = vecAdd(segment.start, vecScale(segment.direction, opening.offset));
      const edge = vecAdd(center, vecScale(outward, segment.thickness / 2));
      const limits: number[] = [];
      if (outward.x > 1e-6) limits.push((lot.width - edge.x) / outward.x);
      if (outward.x < -1e-6) limits.push(edge.x / -outward.x);
      if (outward.y > 1e-6) limits.push((lot.depth - edge.y) / outward.y);
      if (outward.y < -1e-6) limits.push(edge.y / -outward.y);
      const length = Math.min(...limits);
      if (!Number.isFinite(length) || length < 0.5) continue;
      const width = Math.max(1.2, opening.width + 0.4);
      const middle = vecAdd(edge, vecScale(outward, length / 2));
      const halfAlong = vecScale(outward, length / 2);
      const halfAcross = vecScale(segment.direction, width / 2);
      const corners = [
        vecAdd(vecAdd(middle, halfAlong), halfAcross),
        vecAdd(vecAdd(middle, halfAlong), vecScale(halfAcross, -1)),
        vecAdd(vecAdd(middle, vecScale(halfAlong, -1)), halfAcross),
        vecAdd(vecAdd(middle, vecScale(halfAlong, -1)), vecScale(halfAcross, -1)),
      ];
      items.push({
        x: middle.x,
        y: middle.y,
        width,
        depth: length,
        isDriveway: opening.width >= 2,
        angle: Math.atan2(outward.y, outward.x),
        bounds: {
          minX: Math.min(...corners.map((corner) => corner.x)),
          maxX: Math.max(...corners.map((corner) => corner.x)),
          minY: Math.min(...corners.map((corner) => corner.y)),
          maxY: Math.max(...corners.map((corner) => corner.y)),
        },
      });
    }
  }
  return items;
};

const boundsOverlap = (a: Bounds, b: Bounds, margin = 0): boolean =>
  a.minX < b.maxX + margin && a.maxX > b.minX - margin && a.minY < b.maxY + margin && a.maxY > b.minY - margin;

/** Deterministic pseudo-random generator so the garden does not change between renders. */
const createRandom = (seed: number) => {
  let state = Math.floor(seed) % 2147483647 || 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

/** The whole house, generated from the plan. Shared by the 3D view and the walkthrough. */
export const HouseModel = ({ plan, showRoof, hiddenFloorIds = [], mode, timeOfDay = "day", quality = "high", walkFloorId = null }: HouseModelProps) => {
  const materials = useSceneMaterials(plan.materials, plan.settings.frameColor);
  const materialById = useMemo(() => new Map(plan.materials.map((material) => [material.id, material])), [plan.materials]);
  const topIndex = plan.floors.length - 1;
  const ground = plan.floors[0];
  const groundBounds = useMemo(() => (ground ? floorBounds(ground, { indoorOnly: true }) : null), [ground]);
  const paths = useMemo(() => (ground ? computePaths(ground, plan.lot) : []), [ground, plan.lot]);
  const isEvening = timeOfDay === "evening";
  return (
    <group>
      <Ground lot={plan.lot} materials={materials} />
      <Hedges lot={plan.lot} paths={paths} materials={materials} />
      {groundBounds ? <Garden lot={plan.lot} houseBounds={groundBounds} paths={paths} materials={materials} quality={quality} /> : null}
      {groundBounds ? <FlowerBeds lot={plan.lot} houseBounds={groundBounds} paths={paths} /> : null}
      {paths.map((path, index) => (
        <PathSlab key={index} path={path} lot={plan.lot} material={path.isDriveway ? materials.gravel : materials.path} />
      ))}
      {plan.floors.map((floor, index) =>
        hiddenFloorIds.includes(floor.id) ? null : (
          <FloorModel
            key={floor.id}
            floor={floor}
            nextFloor={plan.floors[index + 1] ?? null}
            base={floorBaseHeight(plan, index)}
            isTop={index === topIndex}
            plan={plan}
            materials={materials}
            materialById={materialById}
            mode={mode}
            isEvening={isEvening}
            lightsEnabled={isEvening && (mode === "orbit" || floor.id === walkFloorId)}
          />
        ),
      )}
      {showRoof && topIndex >= 0 ? (
        <RoofModel plan={plan} floor={plan.floors[topIndex]} base={floorBaseHeight(plan, topIndex) + plan.floors[topIndex].height} materials={materials} />
      ) : null}
    </group>
  );
};

const Ground = ({ lot, materials }: { lot: Lot; materials: SceneMaterials }) => {
  // Large enough that the horizon seen from inside the house is countryside, not the end of the world.
  const size = 1200;
  const surroundings = useTiledMaterial(materials.surroundings, size, size);
  const ground = useTiledMaterial(materials.ground, lot.width, lot.depth);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.03} receiveShadow material={surroundings}>
        <planeGeometry args={[size, size]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow material={ground}>
        <planeGeometry args={[lot.width, lot.depth]} />
      </mesh>
      <mesh position-y={-0.02} material={materials.kerb}>
        <boxGeometry args={[lot.width + 0.3, 0.06, lot.depth + 0.3]} />
      </mesh>
    </group>
  );
};

/** Continuous clipped hedges around the lot, interrupted only where paths reach the street. */
const Hedges = ({ lot, paths, materials }: { lot: Lot; paths: PathRect[]; materials: SceneMaterials }) => {
  const runs = useMemo(() => {
    const inset = 0.5;
    const thickness = 0.6;
    const gap = 0.5;
    const items: { x: number; y: number; width: number; depth: number }[] = [];
    // Each side is a 1D interval cut by the paths that cross it.
    const sides: { axis: "x" | "y"; at: number; from: number; to: number }[] = [
      { axis: "x", at: inset, from: inset, to: lot.width - inset },
      { axis: "x", at: lot.depth - inset, from: inset, to: lot.width - inset },
      { axis: "y", at: inset, from: inset + thickness, to: lot.depth - inset - thickness },
      { axis: "y", at: lot.width - inset, from: inset + thickness, to: lot.depth - inset - thickness },
    ];
    for (const side of sides) {
      const cuts = paths
        .filter((path) => (side.axis === "x" ? path.bounds.minY <= side.at + thickness && path.bounds.maxY >= side.at - thickness : path.bounds.minX <= side.at + thickness && path.bounds.maxX >= side.at - thickness))
        .map((path) => (side.axis === "x" ? [path.bounds.minX - gap, path.bounds.maxX + gap] : [path.bounds.minY - gap, path.bounds.maxY + gap]))
        .sort((a, b) => a[0] - b[0]);
      let cursor = side.from;
      const push = (from: number, to: number) => {
        if (to - from < 0.4) return;
        if (side.axis === "x") items.push({ x: (from + to) / 2, y: side.at, width: to - from, depth: thickness });
        else items.push({ x: side.at, y: (from + to) / 2, width: thickness, depth: to - from });
      };
      for (const [cutFrom, cutTo] of cuts) {
        push(cursor, Math.min(cutFrom, side.to));
        cursor = Math.max(cursor, cutTo);
      }
      push(cursor, side.to);
    }
    return items;
  }, [lot.depth, lot.width, paths]);
  const height = 0.9;
  return (
    <group>
      {runs.map((run, index) => {
        const [x, z] = toScene({ x: run.x, y: run.y }, lot);
        return (
          <group key={index} position={[x, 0, z]}>
            <mesh position-y={height / 2} castShadow receiveShadow material={materials.hedge}>
              <boxGeometry args={[run.width, height, run.depth]} />
            </mesh>
            <mesh position-y={height} castShadow material={materials.hedge}>
              <boxGeometry args={[Math.max(0.1, run.width - 0.1), 0.12, Math.max(0.1, run.depth - 0.1)]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

/** Irregular foliage mass: an icosphere whose vertices are pushed in and out deterministically. */
const createCanopyGeometry = (seed: number, detail: number): BufferGeometry => {
  const geometry = new IcosahedronGeometry(1, detail);
  const position = geometry.getAttribute("position");
  const vertex = new Vector3();
  for (let index = 0; index < position.count; index += 1) {
    vertex.fromBufferAttribute(position, index);
    const noise =
      Math.sin(vertex.x * 5.1 + seed) * Math.cos(vertex.y * 4.3 + seed * 1.7) * Math.sin(vertex.z * 4.7 + seed * 0.6) * 0.22 +
      Math.sin(vertex.x * 11 + vertex.z * 9 + seed) * 0.06;
    vertex.multiplyScalar(1 + noise);
    position.setXYZ(index, vertex.x, vertex.y * 0.92, vertex.z);
  }
  geometry.computeVertexNormals();
  return geometry;
};

type TreeSpecies = "round" | "pine" | "column" | "palm";

interface TreeSpec {
  x: number;
  y: number;
  scale: number;
  lean: number;
  species: TreeSpecies;
}

/** Varied trees along the lot and shrubs by the house corners. */
const Garden = ({ lot, houseBounds, paths, materials, quality }: { lot: Lot; houseBounds: Bounds; paths: PathRect[]; materials: SceneMaterials; quality: "low" | "high" }) => {
  const { trees, shrubs } = useMemo(() => {
    const random = createRandom(lot.width * 1000 + lot.depth * 7);
    const species: TreeSpecies[] = ["palm", "round", "column", "palm", "round"];
    const trees: TreeSpec[] = [];
    const clearance = 2.4;
    const inset = 1.6;
    const candidates: { x: number; y: number }[] = [];
    for (let x = inset; x <= lot.width - inset; x += 3.6) {
      candidates.push({ x, y: inset }, { x, y: lot.depth - inset });
    }
    for (let y = inset + 3; y <= lot.depth - inset - 3; y += 3.6) {
      candidates.push({ x: inset, y }, { x: lot.width - inset, y });
    }
    for (const candidate of candidates) {
      const x = candidate.x + (random() - 0.5) * 1.4;
      const y = candidate.y + (random() - 0.5) * 1.4;
      const nearHouse = x > houseBounds.minX - clearance && x < houseBounds.maxX + clearance && y > houseBounds.minY - clearance && y < houseBounds.maxY + clearance;
      const onPath = paths.some((path) => boundsOverlap(path.bounds, { minX: x - 1.2, maxX: x + 1.2, minY: y - 1.2, maxY: y + 1.2 }));
      if (nearHouse || onPath || random() < 0.3) continue;
      trees.push({ x, y, scale: 0.7 + random() * 0.7, lean: (random() - 0.5) * 0.12, species: species[Math.floor(random() * species.length)] });
    }
    const shrubs: { x: number; y: number; r: number }[] = [];
    const corners = [
      { x: houseBounds.minX - 0.7, y: houseBounds.minY - 0.7 },
      { x: houseBounds.maxX + 0.7, y: houseBounds.minY - 0.7 },
      { x: houseBounds.minX - 0.7, y: houseBounds.maxY + 0.7 },
      { x: houseBounds.maxX + 0.7, y: houseBounds.maxY + 0.7 },
    ];
    for (const corner of corners) {
      if (corner.x < 0.5 || corner.x > lot.width - 0.5 || corner.y < 0.5 || corner.y > lot.depth - 0.5) continue;
      if (paths.some((path) => boundsOverlap(path.bounds, { minX: corner.x - 0.6, maxX: corner.x + 0.6, minY: corner.y - 0.6, maxY: corner.y + 0.6 }))) continue;
      for (let index = 0; index < 3; index += 1) {
        shrubs.push({ x: corner.x + (random() - 0.5) * 1.1, y: corner.y + (random() - 0.5) * 1.1, r: 0.3 + random() * 0.25 });
      }
    }
    return { trees, shrubs };
  }, [houseBounds, lot.depth, lot.width, paths]);
  const detail = quality === "high" ? 14 : 8;
  const canopies = useMemo(() => [0, 1, 2].map((seed) => createCanopyGeometry(seed * 2.3 + 1, quality === "high" ? 3 : 2)), [quality]);
  useEffect(() => () => canopies.forEach((geometry) => geometry.dispose()), [canopies]);
  return (
    <group>
      {trees.map((tree, index) => {
        const [x, z] = toScene({ x: tree.x, y: tree.y }, lot);
        return (
          <group key={index} position={[x, 0, z]} scale={tree.scale} rotation-z={tree.lean}>
            {tree.species === "palm" ? (
              <PalmTree seed={index} materials={materials} />
            ) : tree.species === "pine" ? (
              <>
                <mesh position-y={0.7} castShadow material={materials.trunk}>
                  <cylinderGeometry args={[0.09, 0.14, 1.4, 8]} />
                </mesh>
                {[0, 1, 2].map((tier) => (
                  <mesh key={tier} position-y={1.4 + tier * 0.9} castShadow material={tier % 2 === 0 ? materials.leavesDark : materials.leaves}>
                    <coneGeometry args={[1.5 - tier * 0.38, 1.5, detail]} />
                  </mesh>
                ))}
              </>
            ) : tree.species === "column" ? (
              <>
                <mesh position-y={0.5} castShadow material={materials.trunk}>
                  <cylinderGeometry args={[0.08, 0.12, 1, 8]} />
                </mesh>
                <mesh position-y={2.6} scale={[0.75, 2.2, 0.75]} castShadow geometry={canopies[index % 3]} material={materials.leavesDark} />
              </>
            ) : (
              <>
                <mesh position-y={0.8} castShadow material={materials.trunk}>
                  <cylinderGeometry args={[0.1, 0.17, 1.6, 8]} />
                </mesh>
                <mesh position-y={2.4} scale={1.25} castShadow geometry={canopies[index % 3]} material={materials.leaves} />
                <mesh position={[0.55, 3.0, 0.25]} scale={0.9} castShadow geometry={canopies[(index + 1) % 3]} material={materials.leavesDark} />
                <mesh position={[-0.6, 2.75, -0.35]} scale={0.8} castShadow geometry={canopies[(index + 2) % 3]} material={materials.leavesDark} />
                <mesh position={[0.1, 3.35, -0.5]} scale={0.7} castShadow geometry={canopies[index % 3]} material={materials.leaves} />
              </>
            )}
          </group>
        );
      })}
      {shrubs.map((shrub, index) => {
        const [x, z] = toScene({ x: shrub.x, y: shrub.y }, lot);
        return (
          <group key={index} position={[x, 0, z]} rotation-y={index * 1.7}>
            <ScannedModel model="bushes" width={shrub.r * 5} depth={shrub.r * 2} height={shrub.r * 2.2} />
          </group>
        );
      })}
    </group>
  );
};

/** Palm: a gently curved ringed trunk and a crown of drooping fronds. */
const PalmTree = ({ seed, materials }: { seed: number; materials: SceneMaterials }) => {
  const segments = 7;
  const height = 4.2 + (seed % 3) * 0.5;
  const lean = 0.05 + (seed % 4) * 0.025;
  const top = { x: Math.sin(lean * segments) * 0.6, y: height };
  const fronds = 11;
  return (
    <group rotation-y={seed * 1.3}>
      {Array.from({ length: segments }, (_, index) => {
        const t = (index + 0.5) / segments;
        return (
          <mesh key={index} position={[Math.sin(lean * index) * 0.6 * t, t * height, 0]} rotation-z={-lean * index * 0.5} castShadow material={materials.trunk}>
            <cylinderGeometry args={[0.12 - t * 0.04, 0.15 - t * 0.04, height / segments + 0.02, 8]} />
          </mesh>
        );
      })}
      <group position={[top.x, top.y, 0]}>
        {Array.from({ length: fronds }, (_, index) => {
          const angle = (index / fronds) * Math.PI * 2;
          const droop = 0.35 + ((index * 7 + seed) % 5) * 0.12;
          return (
            <group key={index} rotation={[0, angle, 0]}>
              <group rotation={[0, 0, -droop]}>
                <mesh position={[1.15, 0, 0]} scale={[1, 1, 1]} castShadow material={materials.leaves}>
                  <boxGeometry args={[2.3, 0.02, 0.42]} />
                </mesh>
                <mesh position={[2.0, -0.35, 0]} rotation-z={-0.5} castShadow material={materials.leavesDark}>
                  <boxGeometry args={[1, 0.02, 0.3]} />
                </mesh>
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
};

const PathSlab = ({ path, lot, material }: { path: PathRect; lot: Lot; material: MeshStandardMaterial }) => {
  const tiled = useTiledMaterial(material, path.depth, path.width);
  const [x, z] = toScene({ x: path.x, y: path.y }, lot);
  return (
    <mesh position={[x, 0.005, z]} rotation-y={-path.angle} receiveShadow material={tiled}>
      <boxGeometry args={[path.depth, 0.02, path.width]} />
    </mesh>
  );
};

interface FloorModelProps {
  floor: Floor;
  nextFloor: Floor | null;
  base: number;
  isTop: boolean;
  plan: Plan;
  materials: SceneMaterials;
  materialById: Map<string, Material>;
  mode: HouseMode;
  isEvening: boolean;
  lightsEnabled: boolean;
}

const FloorModel = ({ floor, nextFloor, base, isTop, plan, materials, materialById, mode, isEvening, lightsEnabled }: FloorModelProps) => {
  const segments = useMemo(() => buildWallSegments(floor), [floor]);
  const indoorRooms = useMemo(() => floor.rooms.filter((room) => !isOutdoorRoom(room)), [floor.rooms]);
  const exteriorMaterial = pickMaterial(materials, plan.settings.exteriorMaterialId, materials.exterior);
  const showCeilings = mode === "walk" || !isTop;
  return (
    <group>
      {floor.rooms.map((room) => {
        const outdoor = isOutdoorRoom(room);
        if (room.type === "pool") return <Pool key={room.id} room={room} base={base} lot={plan.lot} materials={materials} />;
        return (
          <RoomSlabs
            key={room.id}
            room={room}
            base={base}
            lot={plan.lot}
            height={floor.height}
            floorMaterial={pickMaterial(materials, room.floorMaterialId, materials.floor)}
            ceilingMaterial={showCeilings && !outdoor ? (isTop ? materials.ceiling : materials.terrace) : null}
            materials={materials}
            isEvening={isEvening}
            lightsEnabled={lightsEnabled && !outdoor}
            isOutdoor={outdoor}
          />
        );
      })}
      {floor.rooms.filter((room) => room.type === "carport").map((room) => (
        <Pergola key={`pergola-${room.id}`} room={room} base={base} lot={plan.lot} materials={materials} />
      ))}
      {segments.map((segment) => {
        const library = segment.materialId ? materialById.get(segment.materialId) : undefined;
        const isFacadeMaterial = library?.kind === "exterior";
        return (
          <WallMesh
            key={segment.id}
            segment={segment}
            base={base}
            lot={plan.lot}
            indoorRooms={indoorRooms}
            material={isFacadeMaterial ? materials.wall : pickMaterial(materials, segment.materialId, materials.wall)}
            exteriorMaterial={isFacadeMaterial ? pickMaterial(materials, segment.materialId, exteriorMaterial) : exteriorMaterial}
            materials={materials}
            isEvening={isEvening}
            doorsOpen={mode === "walk"}
          />
        );
      })}
      {!isTop && nextFloor ? <TerraceRailings floor={floor} nextFloor={nextFloor} top={base + floor.height + LEVEL_SLAB_THICKNESS - 0.02} lot={plan.lot} materials={materials} /> : null}
      {floor.furniture.map((item) => (
        <FurnitureMesh
          key={item.id}
          item={item}
          base={base}
          lot={plan.lot}
          materials={materials}
          isEvening={isEvening}
          isOutdoor={floor.rooms.some((room) => isOutdoorRoom(room) && isPointInRoom(room, item))}
        />
      ))}
    </group>
  );
};

/** Swimming pool: raised stone coping and a reflective water surface just above the lawn (the lawn plane is not cut). */
const Pool = ({ room, base, lot, materials }: { room: Room; base: number; lot: Lot; materials: SceneMaterials }) => {
  const [x, z] = toScene(roomCenter(room), lot);
  const depth = 1.5;
  const coping = 0.35;
  const liner = useTiledMaterial(materials.poolTiles, room.width, room.depth);
  const innerWidth = room.width - coping * 2;
  const innerDepth = room.depth - coping * 2;
  return (
    <group position={[x, base, z]}>
      {/* coping frame */}
      <mesh position={[0, 0.03, -room.depth / 2 + coping / 2]} receiveShadow material={materials.sill}>
        <boxGeometry args={[room.width, 0.06, coping]} />
      </mesh>
      <mesh position={[0, 0.03, room.depth / 2 - coping / 2]} receiveShadow material={materials.sill}>
        <boxGeometry args={[room.width, 0.06, coping]} />
      </mesh>
      <mesh position={[-room.width / 2 + coping / 2, 0.03, 0]} receiveShadow material={materials.sill}>
        <boxGeometry args={[coping, 0.06, innerDepth]} />
      </mesh>
      <mesh position={[room.width / 2 - coping / 2, 0.03, 0]} receiveShadow material={materials.sill}>
        <boxGeometry args={[coping, 0.06, innerDepth]} />
      </mesh>
      {/* basin walls and floor */}
      <mesh position={[0, -depth, 0]} receiveShadow material={liner}>
        <boxGeometry args={[innerWidth, 0.05, innerDepth]} />
      </mesh>
      <mesh position={[0, -depth / 2, -innerDepth / 2 + 0.025]} receiveShadow material={liner}>
        <boxGeometry args={[innerWidth, depth, 0.05]} />
      </mesh>
      <mesh position={[0, -depth / 2, innerDepth / 2 - 0.025]} receiveShadow material={liner}>
        <boxGeometry args={[innerWidth, depth, 0.05]} />
      </mesh>
      <mesh position={[-innerWidth / 2 + 0.025, -depth / 2, 0]} receiveShadow material={liner}>
        <boxGeometry args={[0.05, depth, innerDepth]} />
      </mesh>
      <mesh position={[innerWidth / 2 - 0.025, -depth / 2, 0]} receiveShadow material={liner}>
        <boxGeometry args={[0.05, depth, innerDepth]} />
      </mesh>
      <mesh position={[0, 0.035, 0]} rotation-x={-Math.PI / 2} material={materials.water}>
        <planeGeometry args={[innerWidth, innerDepth]} />
      </mesh>
    </group>
  );
};

/** Carport pergola: wooden posts, beams and slats over the slab. */
const Pergola = ({ room, base, lot, materials }: { room: Room; base: number; lot: Lot; materials: SceneMaterials }) => {
  const [x, z] = toScene(roomCenter(room), lot);
  const height = 2.6;
  const post = 0.16;
  const inset = 0.25;
  const slats = Math.max(4, Math.floor(room.width / 0.32));
  return (
    <group position={[x, base, z]}>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (room.width / 2 - inset), height / 2, sz * (room.depth / 2 - inset)]} castShadow material={materials.woodBeam}>
            <boxGeometry args={[post, height, post]} />
          </mesh>
        )),
      )}
      <mesh position={[0, height + 0.1, -room.depth / 2 + inset]} castShadow material={materials.woodBeam}>
        <boxGeometry args={[room.width, 0.2, 0.14]} />
      </mesh>
      <mesh position={[0, height + 0.1, room.depth / 2 - inset]} castShadow material={materials.woodBeam}>
        <boxGeometry args={[room.width, 0.2, 0.14]} />
      </mesh>
      {Array.from({ length: slats }, (_, index) => (
        <mesh key={index} position={[-room.width / 2 + ((index + 0.5) * room.width) / slats, height + 0.26, 0]} castShadow material={materials.woodBeam}>
          <boxGeometry args={[0.06, 0.12, room.depth]} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.34, 0]} material={materials.frame}>
        <boxGeometry args={[room.width - 0.2, 0.03, room.depth - 0.2]} />
      </mesh>
    </group>
  );
};

/** Scanned flowering plants, bushes and grasses scattered along the hedges, away from paths and the house. */
const FlowerBeds = ({ lot, houseBounds, paths }: { lot: Lot; houseBounds: Bounds; paths: PathRect[] }) => {
  const flowers = useMemo(() => {
    const random = createRandom(lot.width * 53 + lot.depth * 97);
    const items: { x: number; y: number; r: number; tone: number }[] = [];
    const candidates = 60;
    for (let index = 0; index < candidates; index += 1) {
      const alongEdge = random();
      const side = Math.floor(random() * 4);
      const offset = 1.3 + random() * 0.6;
      const x = side === 0 ? alongEdge * lot.width : side === 1 ? lot.width - offset : side === 2 ? alongEdge * lot.width : offset;
      const y = side === 0 ? offset : side === 1 ? alongEdge * lot.depth : side === 2 ? lot.depth - offset : alongEdge * lot.depth;
      if (x < 1 || x > lot.width - 1 || y < 1 || y > lot.depth - 1) continue;
      const nearHouse = x > houseBounds.minX - 1.2 && x < houseBounds.maxX + 1.2 && y > houseBounds.minY - 1.2 && y < houseBounds.maxY + 1.2;
      const onPath = paths.some((path) => boundsOverlap(path.bounds, { minX: x - 0.5, maxX: x + 0.5, minY: y - 0.5, maxY: y + 0.5 }));
      if (nearHouse || onPath) continue;
      items.push({ x, y, r: 0.22 + random() * 0.2, tone: Math.floor(random() * 3) });
    }
    return items;
  }, [houseBounds, lot.depth, lot.width, paths]);
  const models = ["flowers", "bushes", "flowers", "tallGrass"] as const;
  return (
    <group>
      {flowers.map((flower, index) => {
        const [x, z] = toScene({ x: flower.x, y: flower.y }, lot);
        const model = models[(flower.tone + index) % models.length];
        const length = 1.4 + flower.r;
        const height = model === "tallGrass" ? 0.45 : model === "flowers" ? 0.4 + flower.r : 0.35 + flower.r;
        return (
          <group key={index} position={[x, 0, z]} rotation-y={flower.x * 3.1 + flower.y * 1.3}>
            <ScannedModel model={model} width={length} depth={length * 0.4} height={height} />
          </group>
        );
      })}
    </group>
  );
};

interface RoomSlabsProps {
  room: Room;
  base: number;
  lot: Lot;
  height: number;
  floorMaterial: MeshStandardMaterial;
  ceilingMaterial: MeshStandardMaterial | null;
  materials: SceneMaterials;
  isEvening: boolean;
  lightsEnabled: boolean;
  isOutdoor: boolean;
}

const RoomSlabs = ({ room, base, lot, height, floorMaterial, ceilingMaterial, materials, isEvening, lightsEnabled, isOutdoor }: RoomSlabsProps) => {
  const [x, z] = toScene(roomCenter(room), lot);
  const tiledFloor = useTiledMaterial(floorMaterial, room.width, room.depth);
  const tiledCeiling = useTiledMaterial(ceilingMaterial ?? floorMaterial, room.width, room.depth);
  const ceilingPaint = useTiledMaterial(materials.ceiling, room.width, room.depth);
  const isGroundDeck = isOutdoor && base < 0.01;
  const hasPendant = ceilingMaterial !== null && room.width * room.depth >= 3;
  return (
    <group>
      <mesh position={[x, base - SLAB_THICKNESS / 2 - (isGroundDeck ? 0.01 : 0), z]} receiveShadow castShadow={isOutdoor} material={tiledFloor}>
        <boxGeometry args={[room.width, isGroundDeck ? 0.12 : SLAB_THICKNESS, room.depth]} />
      </mesh>
      {ceilingMaterial ? (
        // BoxGeometry face order: +x, -x, +y, -y, +z, -z — the underside is always a painted ceiling.
        <mesh
          position={[x, base + height + (LEVEL_SLAB_THICKNESS - 0.02) / 2, z]}
          receiveShadow
          material={[tiledCeiling, tiledCeiling, tiledCeiling, ceilingPaint, tiledCeiling, tiledCeiling]}
        >
          <boxGeometry args={[room.width, LEVEL_SLAB_THICKNESS - 0.02, room.depth]} />
        </mesh>
      ) : null}
      {hasPendant ? (
        <group position={[x, base + height - 0.75, z]}>
          <ScannedModel model="ceilingLamp" width={0.43} depth={0.43} height={0.75} />
          {isEvening ? (
            <mesh position-y={0.12} material={materials.lampLit}>
              <sphereGeometry args={[0.09, 16, 12]} />
            </mesh>
          ) : null}
        </group>
      ) : null}
      {lightsEnabled ? <pointLight position={[x, base + height - 0.6, z]} color="#ffe2c2" intensity={10} distance={9} decay={2} /> : null}
    </group>
  );
};

/** Glass railings along the edges of a floor that stay uncovered by the floor above (terraces). */
const TerraceRailings = ({ floor, nextFloor, top, lot, materials }: { floor: Floor; nextFloor: Floor; top: number; lot: Lot; materials: SceneMaterials }) => {
  const rails = useMemo(() => {
    const lower = floorBounds(floor, { indoorOnly: true });
    const upper = floorBounds(nextFloor, { indoorOnly: true });
    if (!lower || !upper) return [];
    const items: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];
    const inset = 0.6;
    if (upper.maxY < lower.maxY - inset) {
      items.push({ start: { x: lower.minX, y: lower.maxY }, end: { x: lower.maxX, y: lower.maxY } });
      items.push({ start: { x: lower.minX, y: upper.maxY }, end: { x: lower.minX, y: lower.maxY } });
      items.push({ start: { x: lower.maxX, y: upper.maxY }, end: { x: lower.maxX, y: lower.maxY } });
    }
    if (upper.minY > lower.minY + inset) {
      items.push({ start: { x: lower.minX, y: lower.minY }, end: { x: lower.maxX, y: lower.minY } });
      items.push({ start: { x: lower.minX, y: lower.minY }, end: { x: lower.minX, y: upper.minY } });
      items.push({ start: { x: lower.maxX, y: lower.minY }, end: { x: lower.maxX, y: upper.minY } });
    }
    if (upper.maxX < lower.maxX - inset) {
      items.push({ start: { x: lower.maxX, y: lower.minY }, end: { x: lower.maxX, y: lower.maxY } });
      items.push({ start: { x: upper.maxX, y: lower.minY }, end: { x: lower.maxX, y: lower.minY } });
      items.push({ start: { x: upper.maxX, y: lower.maxY }, end: { x: lower.maxX, y: lower.maxY } });
    }
    if (upper.minX > lower.minX + inset) {
      items.push({ start: { x: lower.minX, y: lower.minY }, end: { x: lower.minX, y: lower.maxY } });
      items.push({ start: { x: lower.minX, y: lower.minY }, end: { x: upper.minX, y: lower.minY } });
      items.push({ start: { x: lower.minX, y: lower.maxY }, end: { x: upper.minX, y: lower.maxY } });
    }
    return items.filter((rail) => Math.hypot(rail.end.x - rail.start.x, rail.end.y - rail.start.y) > 0.3);
  }, [floor, nextFloor]);
  return (
    <group>
      {rails.map((rail, index) => {
        const length = Math.hypot(rail.end.x - rail.start.x, rail.end.y - rail.start.y);
        const angle = Math.atan2(rail.end.y - rail.start.y, rail.end.x - rail.start.x);
        const [x, z] = toScene({ x: (rail.start.x + rail.end.x) / 2, y: (rail.start.y + rail.end.y) / 2 }, lot);
        const posts = Math.max(2, Math.round(length / 1.2) + 1);
        return (
          <group key={index} position={[x, top, z]} rotation-y={-angle}>
            <mesh position-y={1.02} material={materials.frame} castShadow>
              <boxGeometry args={[length, 0.04, 0.05]} />
            </mesh>
            <mesh position-y={0.55} material={materials.glass}>
              <boxGeometry args={[length - 0.06, 0.9, 0.012]} />
            </mesh>
            {Array.from({ length: posts }, (_, post) => (
              <mesh key={post} position={[-length / 2 + (length * post) / (posts - 1), 0.5, 0]} material={materials.frame} castShadow>
                <boxGeometry args={[0.04, 1, 0.04]} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
};

interface WallMeshProps {
  segment: WallSegment;
  base: number;
  lot: Lot;
  indoorRooms: Room[];
  material: MeshStandardMaterial;
  exteriorMaterial: MeshStandardMaterial;
  materials: SceneMaterials;
  isEvening: boolean;
  doorsOpen: boolean;
}

const WallMesh = ({ segment, base, lot, indoorRooms, material, exteriorMaterial, materials, isEvening, doorsOpen }: WallMeshProps) => {
  const geometry = useMemo(() => buildWallGeometry(segment, segment.thickness), [segment]);
  const cladding = useMemo(() => (segment.exteriorSide === 0 ? null : buildWallGeometry(segment, 0.012)), [segment]);
  useEffect(
    () => () => {
      geometry.dispose();
      cladding?.dispose();
    },
    [geometry, cladding],
  );
  const interiorSides = useMemo(() => {
    const middle = vecScale(vecAdd(segment.start, segment.end), 0.5);
    const probe = segment.thickness / 2 + 0.1;
    return ([1, -1] as const).filter((side) => indoorRooms.some((room) => isPointInRoom(room, vecAdd(middle, vecScale(segment.normal, side * probe)))));
  }, [indoorRooms, segment]);
  const pieces = useMemo(() => buildSolidSegments([segment]).map((piece) => ({ from: vecLengthAlong(segment, piece.start), to: vecLengthAlong(segment, piece.end) })), [segment]);
  const [x, z] = toScene(segment.start, lot);
  const angle = Math.atan2(segment.direction.y, segment.direction.x);
  const half = segment.thickness / 2;
  return (
    <group position={[x, base, z]} rotation-y={-angle}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      {cladding ? <mesh geometry={cladding} material={exteriorMaterial} position-z={segment.exteriorSide * (half + 0.006)} castShadow /> : null}
      {/* Baseboards on every interior face, interrupted by doors. */}
      {interiorSides.flatMap((side) =>
        pieces.map((piece, index) => (
          <mesh key={`${side}-${index}`} position={[(piece.from + piece.to) / 2, BASEBOARD_HEIGHT / 2, side * (half + 0.008)]} material={materials.trim}>
            <boxGeometry args={[piece.to - piece.from, BASEBOARD_HEIGHT, 0.016]} />
          </mesh>
        )),
      )}
      {/* Plinth along the ground-floor façade. */}
      {segment.exteriorSide !== 0 && base < 0.01
        ? pieces.map((piece, index) => (
            <mesh key={`plinth-${index}`} position={[(piece.from + piece.to) / 2, PLINTH_HEIGHT / 2 - 0.02, segment.exteriorSide * (half + 0.022)]} material={materials.plinth} castShadow>
              <boxGeometry args={[piece.to - piece.from + 0.02, PLINTH_HEIGHT, 0.035]} />
            </mesh>
          ))
        : null}
      {segment.openings.map((opening) =>
        opening.kind === "door" ? (
          <DoorMesh key={opening.id} opening={opening} thickness={segment.thickness} materials={materials} isOpen={doorsOpen} />
        ) : (
          <WindowMesh key={opening.id} opening={opening} thickness={segment.thickness} materials={materials} litSide={isEvening ? segment.exteriorSide : 0} exteriorSide={segment.exteriorSide} />
        ),
      )}
    </group>
  );
};

const vecLengthAlong = (segment: WallSegment, point: { x: number; y: number }): number =>
  (point.x - segment.start.x) * segment.direction.x + (point.y - segment.start.y) * segment.direction.y;

interface OpeningMeshProps {
  opening: WallOpening;
  thickness: number;
  materials: SceneMaterials;
}

/** Door frame plus a leaf: closed in the exterior view, open (80°) during the walkthrough. Sliding doors show glass panels. */
const DoorMesh = ({ opening, thickness, materials, isOpen }: OpeningMeshProps & { isOpen: boolean }) => {
  const { width, height } = opening;
  const depth = thickness + 0.02;
  const isLeft = opening.swing !== "right";
  const leafWidth = width - FRAME * 2 - 0.02;
  const openAngle = isOpen ? (80 * Math.PI) / 180 : 0;
  const frame = (
    <>
      <mesh position={[-width / 2 + FRAME / 2, height / 2, 0]} material={materials.frame} castShadow>
        <boxGeometry args={[FRAME, height, depth]} />
      </mesh>
      <mesh position={[width / 2 - FRAME / 2, height / 2, 0]} material={materials.frame} castShadow>
        <boxGeometry args={[FRAME, height, depth]} />
      </mesh>
      <mesh position={[0, height - FRAME / 2, 0]} material={materials.frame} castShadow>
        <boxGeometry args={[width, FRAME, depth]} />
      </mesh>
    </>
  );
  if (opening.doorType === "sliding") {
    const panelWidth = (width - FRAME * 2) / 2;
    const panelHeight = height - FRAME - 0.02;
    const pane = (
      <>
        <mesh material={materials.frame}>
          <boxGeometry args={[panelWidth, panelHeight, 0.05]} />
        </mesh>
        <mesh material={materials.glass}>
          <boxGeometry args={[panelWidth - 0.08, panelHeight - 0.08, 0.06]} />
        </mesh>
      </>
    );
    return (
      <group position-x={opening.offset}>
        {frame}
        <mesh position={[0, 0.015, 0]} material={materials.frame}>
          <boxGeometry args={[width, 0.03, depth]} />
        </mesh>
        <group position={[-width / 2 + FRAME + panelWidth / 2, panelHeight / 2 + 0.03, 0.02]}>{pane}</group>
        <group position={[isOpen ? -width / 2 + FRAME + panelWidth / 2 : width / 2 - FRAME - panelWidth / 2, panelHeight / 2 + 0.03, -0.03]}>{pane}</group>
      </group>
    );
  }
  return (
    <group position-x={opening.offset}>
      {frame}
      {opening.doorType === "standard" ? (
        <group position={[isLeft ? -width / 2 + FRAME : width / 2 - FRAME, 0, 0]} rotation-y={isLeft ? openAngle : -openAngle}>
          <mesh position={[isLeft ? leafWidth / 2 : -leafWidth / 2, (height - FRAME) / 2, 0]} material={materials.doorLeaf} castShadow>
            <boxGeometry args={[leafWidth, height - FRAME - 0.02, 0.045]} />
          </mesh>
          <mesh position={[isLeft ? leafWidth - 0.1 : -leafWidth + 0.1, 1.05, 0.04]} material={materials.metal}>
            <boxGeometry args={[0.12, 0.025, 0.025]} />
          </mesh>
          <mesh position={[isLeft ? leafWidth - 0.1 : -leafWidth + 0.1, 1.05, -0.04]} material={materials.metal}>
            <boxGeometry args={[0.12, 0.025, 0.025]} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

/** `litSide` (+1 / -1) is the exterior face that glows in the evening; sills are added on both faces of exterior walls. */
const WindowMesh = ({ opening, thickness, materials, litSide, exteriorSide }: OpeningMeshProps & { litSide: 1 | -1 | 0; exteriorSide: 1 | -1 | 0 }) => {
  const { width, height, sillHeight } = opening;
  const depth = thickness + 0.02;
  const centerY = sillHeight + height / 2;
  const mullions = Math.max(0, Math.round(width / 0.9) - 1);
  const glassFaces = [materials.frame, materials.frame, materials.frame, materials.frame, litSide === 1 ? materials.glassLit : materials.glass, litSide === -1 ? materials.glassLit : materials.glass];
  return (
    <group position={[opening.offset, centerY, 0]}>
      <mesh position={[-width / 2 + FRAME / 2, 0, 0]} material={materials.frame} castShadow>
        <boxGeometry args={[FRAME, height, depth]} />
      </mesh>
      <mesh position={[width / 2 - FRAME / 2, 0, 0]} material={materials.frame} castShadow>
        <boxGeometry args={[FRAME, height, depth]} />
      </mesh>
      <mesh position={[0, height / 2 - FRAME / 2, 0]} material={materials.frame} castShadow>
        <boxGeometry args={[width, FRAME, depth]} />
      </mesh>
      <mesh position={[0, -height / 2 + FRAME / 2, 0]} material={materials.frame} castShadow>
        <boxGeometry args={[width, FRAME, depth]} />
      </mesh>
      {Array.from({ length: mullions }, (_, index) => (
        <mesh key={index} position={[-width / 2 + ((index + 1) * width) / (mullions + 1), 0, 0]} material={materials.frame}>
          <boxGeometry args={[0.04, height - FRAME * 2, 0.03]} />
        </mesh>
      ))}
      <mesh material={glassFaces}>
        <boxGeometry args={[width - FRAME * 2, height - FRAME * 2, 0.02]} />
      </mesh>
      {exteriorSide !== 0 ? (
        <>
          <mesh position={[0, -height / 2 - 0.02, exteriorSide * (thickness / 2 + 0.03)]} material={materials.sill} castShadow>
            <boxGeometry args={[width + 0.12, 0.05, 0.16]} />
          </mesh>
          <mesh position={[0, -height / 2 + 0.01, -exteriorSide * (thickness / 2 + 0.02)]} material={materials.trim}>
            <boxGeometry args={[width + 0.08, 0.035, 0.14]} />
          </mesh>
        </>
      ) : null}
    </group>
  );
};

interface RoofModelProps {
  plan: Plan;
  floor: Floor;
  base: number;
  materials: SceneMaterials;
}

const RoofModel = ({ plan, floor, base, materials }: RoofModelProps) => {
  const bounds = useMemo(() => floorBounds(floor, { indoorOnly: true }), [floor]);
  const material = useRoofMaterial(materials, plan.settings.roofMaterialId);
  const { roofType, roofPitch, roofOverhang, solarPanels } = plan.settings;
  const width = bounds ? bounds.maxX - bounds.minX + roofOverhang * 2 : 0;
  const depth = bounds ? bounds.maxY - bounds.minY + roofOverhang * 2 : 0;
  const tiled = useTiledMaterial(material, width, depth);
  const soffit = useTiledMaterial(materials.exterior, width, depth);
  const geometry = useMemo(() => {
    if (!bounds) return null;
    return buildRoofGeometry({ width, depth, pitchDegrees: roofPitch, type: roofType });
  }, [bounds, depth, roofPitch, roofType, width]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!bounds || !geometry) return null;
  const [x, z] = toScene({ x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }, plan.lot);
  const ridgeAlongX = width >= depth;
  const fasciaHeight = roofType === "flat" ? 0.22 : 0.2;
  const fasciaY = roofType === "flat" ? 0.14 : -0.1;
  const fascias: { position: [number, number, number]; size: [number, number, number] }[] = [];
  if (roofType === "flat" || roofType === "hip" || !ridgeAlongX) {
    fascias.push({ position: [0, fasciaY, depth / 2], size: [width + 0.06, fasciaHeight, 0.06] }, { position: [0, fasciaY, -depth / 2], size: [width + 0.06, fasciaHeight, 0.06] });
  }
  if (roofType === "flat" || roofType === "hip" || ridgeAlongX) {
    fascias.push({ position: [width / 2, fasciaY, 0], size: [0.06, fasciaHeight, depth + 0.06] }, { position: [-width / 2, fasciaY, 0], size: [0.06, fasciaHeight, depth + 0.06] });
  }
  const isPitched = roofType !== "flat";
  const long = Math.max(width, depth);
  const short = Math.min(width, depth);
  const pitch = (roofPitch * Math.PI) / 180;
  const ridgeHeight = (short / 2) * Math.tan(pitch);
  // Chimney a quarter along the ridge; solar array on the slope facing +z (south).
  const chimneyAlong = -long / 4;
  const slopeMid = short / 4;
  const slopeY = ridgeHeight / 2;
  return (
    <group position={[x, base, z]}>
      <mesh geometry={geometry} material={roofType === "flat" ? tiled : material} castShadow receiveShadow />
      <mesh position-y={-0.03} material={soffit}>
        <boxGeometry args={[width, 0.06, depth]} />
      </mesh>
      {fascias.map((fascia, index) => (
        <mesh key={index} position={fascia.position} material={materials.fascia} castShadow>
          <boxGeometry args={fascia.size} />
        </mesh>
      ))}
      {/* gutters along the eaves */}
      {fascias.map((fascia, index) => (
        <mesh key={`gutter-${index}`} position={[fascia.position[0], fascia.position[1] - fasciaHeight / 2 + 0.02, fascia.position[2]]} rotation={fascia.size[0] > fascia.size[2] ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]} material={materials.metal}>
          <cylinderGeometry args={[0.07, 0.07, Math.max(fascia.size[0], fascia.size[2]) + 0.1, 10]} />
        </mesh>
      ))}
      {isPitched ? (
        <group rotation-y={ridgeAlongX ? 0 : Math.PI / 2}>
          <mesh position={[chimneyAlong, ridgeHeight - 0.2 + 0.7, 0.15]} castShadow material={materials.plinth}>
            <boxGeometry args={[0.7, 1.4, 0.55]} />
          </mesh>
          <mesh position={[chimneyAlong, ridgeHeight + 0.95, 0.15]} material={materials.fascia}>
            <boxGeometry args={[0.8, 0.1, 0.65]} />
          </mesh>
          {solarPanels ? <SolarArray slopeLength={long} slopeMid={slopeMid} slopeY={slopeY} pitch={pitch} materials={materials} /> : null}
        </group>
      ) : solarPanels ? (
        <group position-y={0.3}>
          <SolarArray slopeLength={width} slopeMid={0} slopeY={0.25} pitch={(28 * Math.PI) / 180} materials={materials} />
        </group>
      ) : null}
    </group>
  );
};

/** Two rows of photovoltaic panels lying on the sunny roof slope (local +z side). */
const SolarArray = ({ slopeLength, slopeMid, slopeY, pitch, materials }: { slopeLength: number; slopeMid: number; slopeY: number; pitch: number; materials: SceneMaterials }) => {
  const panelWidth = 1.05;
  const panelHeight = 1.7;
  const gap = 0.04;
  const columns = Math.max(2, Math.min(8, Math.floor((slopeLength * 0.55) / (panelWidth + gap))));
  const arrayWidth = columns * (panelWidth + gap) - gap;
  return (
    <group position={[0, slopeY + 0.06, slopeMid]} rotation-x={-pitch}>
      {[0, 1].flatMap((row) =>
        Array.from({ length: columns }, (_, column) => (
          <group key={`${row}-${column}`} position={[-arrayWidth / 2 + column * (panelWidth + gap) + panelWidth / 2, 0, (row - 0.5) * (panelHeight + gap)]}>
            <mesh material={materials.metal}>
              <boxGeometry args={[panelWidth, 0.05, panelHeight]} />
            </mesh>
            <mesh position-y={0.03} material={materials.solar}>
              <boxGeometry args={[panelWidth - 0.05, 0.012, panelHeight - 0.05]} />
            </mesh>
          </group>
        )),
      )}
    </group>
  );
};
