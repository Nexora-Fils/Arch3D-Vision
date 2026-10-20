"use client";

import { useEffect, useMemo } from "react";
import type { MeshStandardMaterial } from "three";
import type { Lot, Vec2 } from "@/domain/plan/schema";
import type { StairFlight } from "@/domain/plan/stairs";
import { toScene } from "@/features/viewer-3d/convert";
import { createPhotoMaterial, type SceneMaterials } from "@/features/viewer-3d/scene-materials";

const RAIL_HEIGHT = 0.9;
const TREAD_THICKNESS = 0.04;

interface StairFlightMeshProps {
  flight: StairFlight;
  /** Elevation of the lower floor. */
  base: number;
  lot: Lot;
  materials: SceneMaterials;
  /** Sides without a wall next to them get a handrail (left/right while climbing). */
  openSides: { left: boolean; right: boolean };
}

/**
 * Straight flight: a solid stair body with oak treads, rising exactly to the
 * finished floor of the level above, plus a sloped handrail with balusters
 * on each open side. Local frame: the flight climbs towards -z, +x is its right.
 */
export const StairFlightMesh = ({ flight, base, lot, materials, openSides }: StairFlightMeshProps) => {
  const { item, steps, rise, run, width } = flight;
  const riser = rise / steps;
  const tread = run / steps;
  const oak = useMemo(() => createPhotoMaterial(materials.photos.laminate, "#b07a4a", 0.6), [materials.photos.laminate]);
  useEffect(() => () => oak.dispose(), [oak]);
  const [x, z] = toScene({ x: item.x, y: item.y }, lot);
  const railLength = Math.hypot(run - tread, rise - riser);
  const railAngle = Math.atan2(rise - riser, run - tread);
  const railCenter = { y: (riser + rise) / 2 + RAIL_HEIGHT, z: 0 };
  const sides = [openSides.left ? -1 : 0, openSides.right ? 1 : 0].filter((side) => side !== 0);
  return (
    <group position={[x, base, z]} rotation-y={(-item.rotation * Math.PI) / 180}>
      {Array.from({ length: steps }, (_, index) => {
        const top = riser * (index + 1);
        const centerZ = run / 2 - tread * (index + 0.5);
        return (
          <group key={index}>
            <mesh position={[0, (top - TREAD_THICKNESS) / 2, centerZ]} material={materials.trim} castShadow receiveShadow>
              <boxGeometry args={[width, top - TREAD_THICKNESS, tread]} />
            </mesh>
            <mesh position={[0, top - TREAD_THICKNESS / 2, centerZ + 0.01]} material={oak} castShadow receiveShadow>
              <boxGeometry args={[width + 0.02, TREAD_THICKNESS, tread + 0.02]} />
            </mesh>
          </group>
        );
      })}
      {sides.map((side) => {
        const railX = side * (width / 2 - 0.035);
        return (
          <group key={side}>
            <mesh position={[railX, railCenter.y, railCenter.z]} rotation-x={railAngle} material={materials.frame} castShadow>
              <boxGeometry args={[0.045, 0.045, railLength + 0.1]} />
            </mesh>
            {Array.from({ length: steps }, (_, index) => index)
              .filter((index) => index % 3 === 0 || index === steps - 1)
              .map((index) => {
                const top = riser * (index + 1);
                return (
                  <mesh key={index} position={[railX, top + RAIL_HEIGHT / 2, run / 2 - tread * (index + 0.5)]} material={materials.frame} castShadow>
                    <boxGeometry args={[0.022, RAIL_HEIGHT, 0.022]} />
                  </mesh>
                );
              })}
          </group>
        );
      })}
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
