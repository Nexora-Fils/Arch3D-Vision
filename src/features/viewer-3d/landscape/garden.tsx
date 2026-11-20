"use client";

import { useEffect, useMemo } from "react";
import type { BufferGeometry } from "three";
import type { Bounds } from "@/domain/plan/geometry";
import type { Lot } from "@/domain/plan/schema";
import { toScene } from "@/features/viewer-3d/convert";
import { createRandom, ellipsoidCards, packCards } from "@/features/viewer-3d/landscape/foliage";
import { FoliageCards, useFoliageMaterials } from "@/features/viewer-3d/landscape/foliage-cards";
import { boundsOverlap, type PathRect } from "@/features/viewer-3d/landscape/paths";
import {
  growTree,
  mergeCores,
  mergeLimbs,
  type TreePlacement,
  type TreeSpecies,
} from "@/features/viewer-3d/landscape/tree-geometry";
import { ScannedModel } from "@/features/viewer-3d/scanned-model";
import type { SceneMaterials } from "@/features/viewer-3d/scene-materials";

/**
 * Landscaping generated around the house: lawn blended into the photographed
 * surroundings (`ground.tsx`), paved paths with kerbs from every exterior door
 * (`paths.tsx`), clipped hedges along the lot (`hedges.tsx`), flower beds
 * (`flower-beds.tsx`) and, in this file, trees with bark trunks and leafy
 * crowns, and shrubs. Leaves are instanced alpha-tested cards (one draw call
 * per species, `foliage-cards.tsx`) lit with the normal of their crown or hedge.
 */

const useDisposable = (geometry: BufferGeometry | null) => {
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
};

interface GardenProps {
  lot: Lot;
  houseBounds: Bounds;
  paths: PathRect[];
  materials: SceneMaterials;
  quality: "low" | "high";
}

/** Trees along the lot and shrubs by the house corners. */
export const Garden = ({ lot, houseBounds, paths, materials, quality }: GardenProps) => {
  const foliage = useFoliageMaterials();
  const { trees, shrubs } = useMemo(() => {
    const random = createRandom(lot.width * 1000 + lot.depth * 7);
    const species: TreeSpecies[] = ["broadleaf", "birch", "broadleaf", "conifer", "broadleaf", "birch"];
    const placements: TreePlacement[] = [];
    const clearance = 2.6;
    const inset = 2;
    const candidates: { x: number; y: number }[] = [];
    for (let x = inset; x <= lot.width - inset; x += 4.2) candidates.push({ x, y: inset }, { x, y: lot.depth - inset });
    for (let y = inset + 3; y <= lot.depth - inset - 3; y += 4.2)
      candidates.push({ x: inset, y }, { x: lot.width - inset, y });
    for (const candidate of candidates) {
      const x = candidate.x + (random() - 0.5) * 1.2;
      const y = candidate.y + (random() - 0.5) * 0.6;
      const nearHouse =
        x > houseBounds.minX - clearance &&
        x < houseBounds.maxX + clearance &&
        y > houseBounds.minY - clearance &&
        y < houseBounds.maxY + clearance;
      const onPath = paths.some((path) =>
        boundsOverlap(path.bounds, { minX: x - 1.6, maxX: x + 1.6, minY: y - 1.6, maxY: y + 1.6 }),
      );
      if (nearHouse || onPath || random() < 0.35) continue;
      const [sx, sz] = toScene({ x, y }, lot);
      placements.push({
        x: sx,
        z: sz,
        scale: 0.75 + random() * 0.6,
        species: species[Math.floor(random() * species.length)],
      });
    }
    const shrubs: { x: number; y: number; r: number }[] = [];
    const corners = [
      { x: houseBounds.minX - 0.8, y: houseBounds.minY - 0.8 },
      { x: houseBounds.maxX + 0.8, y: houseBounds.minY - 0.8 },
      { x: houseBounds.minX - 0.8, y: houseBounds.maxY + 0.8 },
      { x: houseBounds.maxX + 0.8, y: houseBounds.maxY + 0.8 },
    ];
    for (const corner of corners) {
      if (corner.x < 0.8 || corner.x > lot.width - 0.8 || corner.y < 0.8 || corner.y > lot.depth - 0.8) continue;
      if (
        paths.some((path) =>
          boundsOverlap(path.bounds, {
            minX: corner.x - 0.7,
            maxX: corner.x + 0.7,
            minY: corner.y - 0.7,
            maxY: corner.y + 0.7,
          }),
        )
      )
        continue;
      for (let index = 0; index < 3; index += 1)
        shrubs.push({
          x: corner.x + (random() - 0.5) * 1.1,
          y: corner.y + (random() - 0.5) * 1.1,
          r: 0.3 + random() * 0.25,
        });
    }
    return { trees: placements, shrubs };
  }, [houseBounds, lot, paths]);

  const grown = useMemo(() => {
    const random = createRandom(trees.length * 97 + lot.width);
    return trees.map((tree) => ({ tree, ...growTree(tree, random) }));
  }, [trees, lot.width]);
  const density = quality === "high" ? 30 : 14;
  const cardsBySpecies = useMemo(() => {
    const random = createRandom(lot.depth * 53 + 11);
    const pack = (species: TreeSpecies) => {
      const trees = grown.filter(({ tree }) => tree.species === species);
      const size: [number, number] = species === "conifer" ? [0.45, 0.7] : [0.55, 0.9];
      // Each tree gets its own shade, so neighbours of one species do not look cloned.
      const cards = trees.flatMap(({ lobes }) => {
        const tint = 0.84 + random() * 0.3;
        return lobes.flatMap((lobe) => ellipsoidCards(lobe.center, lobe.radii, density, size, random, tint));
      });
      return cards.length > 0 ? packCards(cards, random) : null;
    };
    return { broadleaf: pack("broadleaf"), birch: pack("birch"), conifer: pack("conifer") };
  }, [grown, density, lot.depth]);
  const bark = useDisposable(
    useMemo(
      () => mergeLimbs(grown.filter(({ tree }) => tree.species !== "birch").flatMap(({ limbs }) => limbs)),
      [grown],
    ),
  );
  const birchBark = useDisposable(
    useMemo(
      () => mergeLimbs(grown.filter(({ tree }) => tree.species === "birch").flatMap(({ limbs }) => limbs)),
      [grown],
    ),
  );
  const cores = useDisposable(useMemo(() => mergeCores(grown.flatMap(({ lobes }) => lobes)), [grown]));
  const birchMaterial = useMemo(() => {
    const material = materials.bark.clone();
    material.map = null;
    material.color.set("#e2ded5");
    return material;
  }, [materials.bark]);
  useEffect(() => () => birchMaterial.dispose(), [birchMaterial]);

  return (
    <group>
      {bark ? <mesh geometry={bark} material={materials.bark} castShadow receiveShadow /> : null}
      {birchBark ? <mesh geometry={birchBark} material={birchMaterial} castShadow receiveShadow /> : null}
      {cores ? <mesh geometry={cores} material={foliage.core} castShadow receiveShadow /> : null}
      {cardsBySpecies.broadleaf ? <FoliageCards set={cardsBySpecies.broadleaf} material={foliage.broadleaf} /> : null}
      {cardsBySpecies.birch ? <FoliageCards set={cardsBySpecies.birch} material={foliage.birch} /> : null}
      {cardsBySpecies.conifer ? <FoliageCards set={cardsBySpecies.conifer} material={foliage.conifer} /> : null}
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
