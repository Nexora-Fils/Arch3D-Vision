"use client";

import { useMemo } from "react";
import {
  floorBaseHeight,
  floorBounds,
  LEVEL_SLAB_THICKNESS,
  isOutdoorRoom,
  isPointInRoom,
} from "@/domain/plan/geometry";
import { buildSolidSegments, buildWallSegments } from "@/domain/plan/wall-segments";
import type { Floor, Material, Plan } from "@/domain/plan/schema";
import { buildStairFlights, isStairs, type StairFlight } from "@/domain/plan/stairs";
import { FurnitureMesh } from "@/features/viewer-3d/furniture-mesh";
import type { JoineryStyle } from "@/features/viewer-3d/architecture/openings";
import { Pergola, Pool } from "@/features/viewer-3d/architecture/outdoor-structures";
import { RoofAssembly } from "@/features/viewer-3d/architecture/roof-assembly";
import { RoomSlabs } from "@/features/viewer-3d/architecture/room-slabs";
import { TerraceRailings } from "@/features/viewer-3d/architecture/terrace-railings";
import { WallMesh } from "@/features/viewer-3d/architecture/wall-mesh";
import { FlowerBeds } from "@/features/viewer-3d/landscape/flower-beds";
import { Garden } from "@/features/viewer-3d/landscape/garden";
import { Ground } from "@/features/viewer-3d/landscape/ground";
import { Hedges } from "@/features/viewer-3d/landscape/hedges";
import { computePaths, PathSlab } from "@/features/viewer-3d/landscape/paths";
import { pickMaterial, useSceneMaterials, type SceneMaterials } from "@/features/viewer-3d/scene-materials";
import { photoForMaterial } from "@/features/viewer-3d/textures";
import { StairModel, StairwellGuards } from "@/features/viewer-3d/stair-mesh";
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

/** The whole house, generated from the plan. Shared by the 3D view and the walkthrough. */
export const HouseModel = ({
  plan,
  showRoof,
  hiddenFloorIds = [],
  mode,
  timeOfDay = "day",
  quality = "high",
  walkFloorId = null,
}: HouseModelProps) => {
  const materials = useSceneMaterials(plan.materials, plan.settings.frameColor, quality);
  const materialById = useMemo(
    () => new Map(plan.materials.map((material) => [material.id, material])),
    [plan.materials],
  );
  const topIndex = plan.floors.length - 1;
  const flights = useMemo(() => buildStairFlights(plan), [plan]);
  const ground = plan.floors[0];
  const groundBounds = useMemo(() => (ground ? floorBounds(ground, { indoorOnly: true }) : null), [ground]);
  const paths = useMemo(() => (ground ? computePaths(ground, plan.lot) : []), [ground, plan.lot]);
  const isEvening = timeOfDay === "evening";
  const { settings } = plan;
  const joinery = useMemo<JoineryStyle>(
    () => ({ shutters: settings.shutters, surrounds: settings.shutters, traditional: settings.shutters }),
    [settings.shutters],
  );
  const roofLibrary = settings.roofMaterialId ? materialById.get(settings.roofMaterialId) : undefined;
  return (
    <group>
      <Ground lot={plan.lot} materials={materials} quality={quality} />
      <Hedges lot={plan.lot} paths={paths} quality={quality} />
      {groundBounds ? (
        <Garden lot={plan.lot} houseBounds={groundBounds} paths={paths} materials={materials} quality={quality} />
      ) : null}
      {groundBounds ? <FlowerBeds lot={plan.lot} houseBounds={groundBounds} paths={paths} /> : null}
      {paths.map((path, index) => (
        <PathSlab
          key={index}
          path={path}
          lot={plan.lot}
          material={path.isDriveway ? materials.gravel : materials.path}
          materials={materials}
        />
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

const FloorModel = ({
  floor,
  flightsFrom,
  flightsTo,
  nextFloor,
  base,
  isTop,
  plan,
  materials,
  materialById,
  joinery,
  mode,
  isEvening,
  lightsEnabled,
}: FloorModelProps) => {
  const segments = useMemo(() => buildWallSegments(floor), [floor]);
  const walls = useMemo(() => buildSolidSegments(segments), [segments]);
  const floorHoles = useMemo(() => flightsTo.flatMap((flight) => flight.openings), [flightsTo]);
  const ceilingHoles = useMemo(() => flightsFrom.flatMap((flight) => flight.openings), [flightsFrom]);
  const flightByItem = useMemo(() => new Map(flightsFrom.map((flight) => [flight.item.id, flight])), [flightsFrom]);
  const indoorRooms = useMemo(() => floor.rooms.filter((room) => !isOutdoorRoom(room)), [floor.rooms]);
  const exteriorMaterial = pickMaterial(materials, plan.settings.exteriorMaterialId, materials.exterior);
  const showCeilings = mode === "walk" || !isTop;
  return (
    <group>
      {floor.rooms.map((room) => {
        const outdoor = isOutdoorRoom(room);
        if (room.type === "pool")
          return <Pool key={room.id} room={room} base={base} lot={plan.lot} materials={materials} />;
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
      {floor.rooms
        .filter((room) => room.type === "carport")
        .map((room) => (
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
            exteriorMaterial={
              isFacadeMaterial ? pickMaterial(materials, segment.materialId, exteriorMaterial) : exteriorMaterial
            }
            materials={materials}
            joinery={joinery}
            isEvening={isEvening}
            doorsOpen={mode === "walk"}
          />
        );
      })}
      {!isTop && nextFloor ? (
        <TerraceRailings
          floor={floor}
          nextFloor={nextFloor}
          top={base + floor.height + LEVEL_SLAB_THICKNESS - 0.02}
          lot={plan.lot}
          materials={materials}
        />
      ) : null}
      {floor.furniture.map((item) => {
        if (isStairs(item.type)) {
          return (
            <StairModel
              key={item.id}
              item={item}
              flight={flightByItem.get(item.id) ?? null}
              walls={walls}
              base={base}
              lot={plan.lot}
              materials={materials}
            />
          );
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
        <StairwellGuards
          key={flight.id}
          flight={flight}
          walls={walls}
          top={base}
          lot={plan.lot}
          materials={materials}
        />
      ))}
    </group>
  );
};
