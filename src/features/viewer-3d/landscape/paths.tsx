"use client";

import type { MeshStandardMaterial } from "three";
import { vecAdd, vecScale, type Bounds } from "@/domain/plan/geometry";
import type { Floor, Lot } from "@/domain/plan/schema";
import { buildWallSegments } from "@/domain/plan/wall-segments";
import { MetricBox } from "@/features/viewer-3d/architecture/parts";
import { toScene } from "@/features/viewer-3d/convert";
import { useTiledMaterial, type SceneMaterials } from "@/features/viewer-3d/scene-materials";

export interface PathRect {
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

/** Paved paths from every exterior ground-floor door to the lot edge (driveway for the garage). */
export const computePaths = (floor: Floor, lot: Lot): PathRect[] => {
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

export const boundsOverlap = (a: Bounds, b: Bounds, margin = 0): boolean =>
  a.minX < b.maxX + margin && a.maxX > b.minX - margin && a.minY < b.maxY + margin && a.maxY > b.minY - margin;

interface PathSlabProps {
  path: PathRect;
  lot: Lot;
  material: MeshStandardMaterial;
  materials: SceneMaterials;
}

/** Paved path (or gravel driveway) with concrete kerbs along both sides. */
export const PathSlab = ({ path, lot, material, materials }: PathSlabProps) => {
  const tiled = useTiledMaterial(material, path.depth, path.width);
  const [x, z] = toScene({ x: path.x, y: path.y }, lot);
  const kerb = 0.08;
  return (
    <group position={[x, 0, z]} rotation-y={-path.angle}>
      <mesh position-y={0.012} receiveShadow material={tiled}>
        <boxGeometry args={[path.depth, 0.03, path.width]} />
      </mesh>
      {[1, -1].map((side) => (
        // Nearly flush kerbs: their top (3.4 cm) stays under a pool's water level (3.5 cm) when a path runs past it.
        <MetricBox
          key={side}
          size={[path.depth, 0.05, kerb]}
          position={[0, 0.009, side * (path.width / 2 + kerb / 2)]}
          material={materials.kerb}
          castShadow
        />
      ))}
    </group>
  );
};
