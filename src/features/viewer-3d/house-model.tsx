"use client";

import { useEffect, useMemo } from "react";
import type { MeshStandardMaterial } from "three";
import {
  buildSolidSegments,
  buildWallSegments,
  floorBaseHeight,
  floorBounds,
  LEVEL_SLAB_THICKNESS,
  isOutdoorRoom,
  isPointInRoom,
  roomCenter,
  vecAdd,
  vecScale,
  type Bounds,
  type SolidSegment,
  type WallSegment,
} from "@/domain/plan/geometry";
import type { Floor, Lot, Material, Plan, Room } from "@/domain/plan/schema";
import { toScene } from "@/features/viewer-3d/convert";
import { distanceToWalls, buildStairFlights, subtractRects, type StairFlight } from "@/domain/plan/stairs";
import { FurnitureMesh } from "@/features/viewer-3d/furniture-mesh";
import { ScannedModel } from "@/features/viewer-3d/scanned-model";
import { DoorUnit, WindowUnit, type JoineryStyle } from "@/features/viewer-3d/architecture/openings";
import { RoofAssembly } from "@/features/viewer-3d/architecture/roof-assembly";
import { computePaths, FlowerBeds, Garden, Ground, Hedges, PathSlab } from "@/features/viewer-3d/landscape/garden";
import { pickMaterial, useSceneMaterials, useTiledMaterial, type SceneMaterials } from "@/features/viewer-3d/scene-materials";
import { photoForMaterial } from "@/features/viewer-3d/textures";
import { GuardRail, StairFlightMesh } from "@/features/viewer-3d/stair-mesh";
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
const BASEBOARD_HEIGHT = 0.08;
/** Base course of the ground-floor façade (soubassement), in the plinth material. */
const PLINTH_HEIGHT = 0.32;

/** The whole house, generated from the plan. Shared by the 3D view and the walkthrough. */
export const HouseModel = ({ plan, showRoof, hiddenFloorIds = [], mode, timeOfDay = "day", quality = "high", walkFloorId = null }: HouseModelProps) => {
  const materials = useSceneMaterials(plan.materials, plan.settings.frameColor, quality);
  const materialById = useMemo(() => new Map(plan.materials.map((material) => [material.id, material])), [plan.materials]);
  const topIndex = plan.floors.length - 1;
  const flights = useMemo(() => buildStairFlights(plan), [plan]);
  const ground = plan.floors[0];
  const groundBounds = useMemo(() => (ground ? floorBounds(ground, { indoorOnly: true }) : null), [ground]);
  const paths = useMemo(() => (ground ? computePaths(ground, plan.lot) : []), [ground, plan.lot]);
  const isEvening = timeOfDay === "evening";
  const { settings } = plan;
  const joinery = useMemo<JoineryStyle>(() => ({ shutters: settings.shutters, surrounds: settings.shutters, traditional: settings.shutters }), [settings.shutters]);
  const roofLibrary = settings.roofMaterialId ? materialById.get(settings.roofMaterialId) : undefined;
  return (
    <group>
      <Ground lot={plan.lot} materials={materials} quality={quality} />
      <Hedges lot={plan.lot} paths={paths} quality={quality} />
      {groundBounds ? <Garden lot={plan.lot} houseBounds={groundBounds} paths={paths} materials={materials} quality={quality} /> : null}
      {groundBounds ? <FlowerBeds lot={plan.lot} houseBounds={groundBounds} paths={paths} /> : null}
      {paths.map((path, index) => (
        <PathSlab key={index} path={path} lot={plan.lot} material={path.isDriveway ? materials.gravel : materials.path} materials={materials} />
      ))}
      {plan.floors.map((floor, index) =>
        hiddenFloorIds.includes(floor.id) ? null : (
          <FloorModel
            key={floor.id}
            floor={floor}
            nextFloor={plan.floors[index + 1] ?? null}
            base={floorBaseHeight(plan, index)}
            // A floor is "top" when nothing is shown above it (upper levels can be hidden for a cutaway).
            isTop={!plan.floors.slice(index + 1).some((upper) => !hiddenFloorIds.includes(upper.id))}
            flightsFrom={flights.filter((flight) => flight.lowerIndex === index)}
            flightsTo={flights.filter((flight) => flight.upperIndex === index)}
            plan={plan}
            materials={materials}
            materialById={materialById}
            joinery={joinery}
            mode={mode}
            isEvening={isEvening}
            lightsEnabled={isEvening && (mode === "orbit" || floor.id === walkFloorId)}
          />
        ),
      )}
      {showRoof && topIndex >= 0 ? (
        <RoofAssembly
          floor={plan.floors[topIndex]}
          lowerFloors={plan.floors.slice(0, topIndex)}
          settings={settings}
          base={floorBaseHeight(plan, topIndex) + plan.floors[topIndex].height}
          lot={plan.lot}
          materials={materials}
          covering={pickMaterial(materials, settings.roofMaterialId, materials.roof)}
          facade={pickMaterial(materials, settings.exteriorMaterialId, materials.exterior)}
          isClay={roofLibrary ? photoForMaterial(roofLibrary) === "clayTiles" : false}
        />
      ) : null}
    </group>
  );
};

interface FloorModelProps {
  floor: Floor;
  /** Flights climbing from this floor (their stairwell is cut in this floor's ceiling). */
  flightsFrom: StairFlight[];
  /** Flights arriving on this floor (their stairwell is cut in this floor's slab). */
  flightsTo: StairFlight[];
  nextFloor: Floor | null;
  base: number;
  isTop: boolean;
  plan: Plan;
  materials: SceneMaterials;
  materialById: Map<string, Material>;
  joinery: JoineryStyle;
  mode: HouseMode;
  isEvening: boolean;
  lightsEnabled: boolean;
}

const FloorModel = ({ floor, flightsFrom, flightsTo, nextFloor, base, isTop, plan, materials, materialById, joinery, mode, isEvening, lightsEnabled }: FloorModelProps) => {
  const segments = useMemo(() => buildWallSegments(floor), [floor]);
  const walls = useMemo(() => buildSolidSegments(segments), [segments]);
  const floorHoles = useMemo(() => flightsTo.map((flight) => flight.opening), [flightsTo]);
  const ceilingHoles = useMemo(() => flightsFrom.map((flight) => flight.opening), [flightsFrom]);
  const flightByItem = useMemo(() => new Map(flightsFrom.map((flight) => [flight.item.id, flight])), [flightsFrom]);
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
            floorHoles={outdoor ? [] : floorHoles}
            ceilingHoles={outdoor ? [] : ceilingHoles}
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
            joinery={joinery}
            isEvening={isEvening}
            doorsOpen={mode === "walk"}
          />
        );
      })}
      {!isTop && nextFloor ? <TerraceRailings floor={floor} nextFloor={nextFloor} top={base + floor.height + LEVEL_SLAB_THICKNESS - 0.02} lot={plan.lot} materials={materials} /> : null}
      {floor.furniture.map((item) => {
        const flight = flightByItem.get(item.id);
        if (flight) {
          const [bottomLeft, bottomRight, topRight, topLeft] = flight.corners;
          const middle = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
          const openSides = {
            left: distanceToWalls(walls, middle(bottomLeft, topLeft)) > HANDRAIL_WALL_CLEARANCE,
            right: distanceToWalls(walls, middle(bottomRight, topRight)) > HANDRAIL_WALL_CLEARANCE,
          };
          return <StairFlightMesh key={item.id} flight={flight} base={base} lot={plan.lot} materials={materials} openSides={openSides} />;
        }
        return (
          <FurnitureMesh
            key={item.id}
            item={item}
            base={base}
            lot={plan.lot}
            materials={materials}
            isEvening={isEvening}
            isOutdoor={floor.rooms.some((room) => isOutdoorRoom(room) && isPointInRoom(room, item))}
          />
        );
      })}
      {flightsTo.map((flight) => (
        <StairwellGuards key={flight.id} flight={flight} walls={walls} top={base} lot={plan.lot} materials={materials} />
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

interface RoomSlabsProps {
  room: Room;
  floorHoles: Bounds[];
  ceilingHoles: Bounds[];
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

const RoomSlabs = ({ room, base, lot, height, floorMaterial, ceilingMaterial, materials, isEvening, lightsEnabled, isOutdoor, floorHoles, ceilingHoles }: RoomSlabsProps) => {
  const bounds = useMemo<Bounds>(() => ({ minX: room.x, minY: room.y, maxX: room.x + room.width, maxY: room.y + room.depth }), [room.x, room.y, room.width, room.depth]);
  const floorPieces = useMemo(() => subtractRects(bounds, floorHoles), [bounds, floorHoles]);
  const ceilingPieces = useMemo(() => subtractRects(bounds, ceilingHoles), [bounds, ceilingHoles]);
  // The pendant and its light hang over the largest part of the room that is not a stairwell.
  const lampSpot = useMemo(() => {
    const pieces = subtractRects(bounds, [...floorHoles, ...ceilingHoles]);
    const largest = pieces.reduce<Bounds | null>((best, piece) => {
      const area = (piece.maxX - piece.minX) * (piece.maxY - piece.minY);
      return !best || area > (best.maxX - best.minX) * (best.maxY - best.minY) ? piece : best;
    }, null);
    if (!largest) return null;
    return { x: (largest.minX + largest.maxX) / 2, y: (largest.minY + largest.maxY) / 2, area: (largest.maxX - largest.minX) * (largest.maxY - largest.minY) };
  }, [bounds, floorHoles, ceilingHoles]);
  const isGroundDeck = isOutdoor && base < 0.01;
  const hasPendant = ceilingMaterial !== null && lampSpot !== null && lampSpot.area >= 3;
  const [lampX, lampZ] = lampSpot ? toScene(lampSpot, lot) : [0, 0];
  return (
    <group>
      {floorPieces.map((piece, index) => (
        <SlabPiece
          key={`floor-${index}`}
          piece={piece}
          room={bounds}
          lot={lot}
          bottom={base - SLAB_THICKNESS - (isGroundDeck ? 0.02 : 0)}
          thickness={isGroundDeck ? 0.12 : SLAB_THICKNESS}
          edges={isGroundDeck ? materials.kerb : undefined}
          material={floorMaterial}
          castShadow={isOutdoor}
        />
      ))}
      {ceilingMaterial
        ? ceilingPieces.map((piece, index) => (
            <SlabPiece
              key={`ceiling-${index}`}
              piece={piece}
              room={bounds}
              lot={lot}
              bottom={base + height}
              thickness={LEVEL_SLAB_THICKNESS - 0.02}
              material={ceilingMaterial}
              underside={isEvening ? materials.ceiling : materials.ceilingDaylight}
            />
          ))
        : null}
      {hasPendant ? (
        <group position={[lampX, base + height - 0.75, lampZ]}>
          <ScannedModel model="ceilingLamp" width={0.43} depth={0.43} height={0.75} />
          {isEvening ? (
            <mesh position-y={0.12} material={materials.lampLit}>
              <sphereGeometry args={[0.09, 16, 12]} />
            </mesh>
          ) : null}
        </group>
      ) : null}
      {lightsEnabled && lampSpot ? <pointLight position={[lampX, base + height - 0.6, lampZ]} color="#ffe2c2" intensity={10} distance={9} decay={2} /> : null}
    </group>
  );
};

interface SlabPieceProps {
  piece: Bounds;
  /** Whole room, so textures stay continuous across the pieces around a stairwell. */
  room: Bounds;
  lot: Lot;
  bottom: number;
  thickness: number;
  material: MeshStandardMaterial;
  /** Material of the underside (painted ceiling); defaults to `material`. */
  underside?: MeshStandardMaterial;
  /** Material of the four sides (concrete edging of ground-level terraces); defaults to `material`. */
  edges?: MeshStandardMaterial;
  castShadow?: boolean;
}

const SlabPiece = ({ piece, room, lot, bottom, thickness, material, underside, edges, castShadow = false }: SlabPieceProps) => {
  const width = piece.maxX - piece.minX;
  const depth = piece.maxY - piece.minY;
  // Box top faces map U along +x and V towards -y: offset by the piece's corner within the room.
  const offsetX = piece.minX - room.minX;
  const offsetY = room.maxY - piece.maxY;
  const top = useTiledMaterial(material, width, depth, offsetX, offsetY);
  const below = useTiledMaterial(underside ?? material, width, depth, offsetX, offsetY);
  const [x, z] = toScene({ x: (piece.minX + piece.maxX) / 2, y: (piece.minY + piece.maxY) / 2 }, lot);
  return (
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
    <mesh position={[x, bottom + thickness / 2, z]} receiveShadow castShadow={castShadow} material={[edges ?? top, edges ?? top, top, below, edges ?? top, edges ?? top]}>
      <boxGeometry args={[width, thickness, depth]} />
    </mesh>
  );
};

/** Distance from a wall below which a flight side or a stairwell edge needs no handrail (m). */
const HANDRAIL_WALL_CLEARANCE = 0.25;

/** Glass guards around a stairwell, on every edge except the arrival and the edges along a wall. */
const StairwellGuards = ({ flight, walls, top, lot, materials }: { flight: StairFlight; walls: SolidSegment[]; top: number; lot: Lot; materials: SceneMaterials }) => {
  const [bottomLeft, bottomRight, topRight, topLeft] = flight.corners;
  const edges = [
    { start: bottomLeft, end: topLeft },
    { start: bottomRight, end: topRight },
    { start: bottomLeft, end: bottomRight },
  ].filter(({ start, end }) => distanceToWalls(walls, { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }) > HANDRAIL_WALL_CLEARANCE);
  return (
    <group>
      {edges.map((edge, index) => (
        <GuardRail key={index} start={edge.start} end={edge.end} top={top} lot={lot} materials={materials} />
      ))}
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
      {rails.map((rail, index) => (
        <GuardRail key={index} start={rail.start} end={rail.end} top={top} lot={lot} materials={materials} />
      ))}
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
  joinery: JoineryStyle;
  isEvening: boolean;
  doorsOpen: boolean;
}

const WallMesh = ({ segment, base, lot, indoorRooms, material, exteriorMaterial, materials, joinery, isEvening, doorsOpen }: WallMeshProps) => {
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
          <DoorUnit key={opening.id} opening={opening} thickness={segment.thickness} exteriorSide={segment.exteriorSide} materials={materials} style={joinery} facade={exteriorMaterial} isOpen={doorsOpen} />
        ) : (
          <WindowUnit key={opening.id} opening={opening} thickness={segment.thickness} exteriorSide={segment.exteriorSide} materials={materials} style={joinery} facade={exteriorMaterial} isLit={isEvening && segment.exteriorSide !== 0} />
        ),
      )}
    </group>
  );
};

const vecLengthAlong = (segment: WallSegment, point: { x: number; y: number }): number =>
  (point.x - segment.start.x) * segment.direction.x + (point.y - segment.start.y) * segment.direction.y;
