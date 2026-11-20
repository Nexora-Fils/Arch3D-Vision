"use client";

import { useEffect, useMemo } from "react";
import { InstancedMesh, MeshStandardMaterial, PlaneGeometry } from "three";
import {
  cardAttributes,
  createFoliageMaterial,
  createLeafAtlas,
  type CardSet,
} from "@/features/viewer-3d/landscape/foliage";

interface FoliageCardsProps {
  set: CardSet;
  material: MeshStandardMaterial;
}

/** Instanced leaf cards sharing one material (one draw call). */
export const FoliageCards = ({ set, material }: FoliageCardsProps) => {
  const mesh = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1);
    const attributes = cardAttributes(set);
    geometry.setAttribute("foliageNormal", attributes.foliageNormal);
    const instanced = new InstancedMesh(geometry, material, set.count);
    instanced.instanceMatrix = attributes.instanceMatrix;
    instanced.instanceColor = attributes.instanceColor;
    instanced.castShadow = true;
    instanced.receiveShadow = true;
    instanced.computeBoundingSphere();
    return instanced;
  }, [set, material]);
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);
  return <primitive object={mesh} />;
};

/** Leaf atlas and the foliage materials of every species, created once per scene. */
export const useFoliageMaterials = () => {
  const materials = useMemo(() => {
    const atlas = createLeafAtlas();
    return {
      atlas,
      hedge: createFoliageMaterial(atlas, "#8fae78"),
      broadleaf: createFoliageMaterial(atlas, "#cfe0a6"),
      birch: createFoliageMaterial(atlas, "#e4ef9c"),
      conifer: createFoliageMaterial(atlas, "#6f8f62"),
      core: new MeshStandardMaterial({ color: "#2c4420", roughness: 1 }),
    };
  }, []);
  useEffect(
    () => () => {
      materials.atlas.dispose();
      for (const material of [materials.hedge, materials.broadleaf, materials.birch, materials.conifer, materials.core])
        material.dispose();
    },
    [materials],
  );
  return materials;
};
