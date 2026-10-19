"use client";

import { useEffect, useMemo } from "react";
import { Color, DoubleSide, MeshStandardMaterial, Vector2, type Texture } from "three";
import type { Material } from "@/domain/plan/schema";
import { tintFor, usePhotoTextures, type PhotoKey, type PhotoSet } from "@/features/viewer-3d/photo-textures";
import { photoForMaterial } from "@/features/viewer-3d/textures";

export interface SceneMaterials {
  photos: Record<PhotoKey, PhotoSet>;
  byId: Map<string, MeshStandardMaterial>;
  wall: MeshStandardMaterial;
  floor: MeshStandardMaterial;
  roof: MeshStandardMaterial;
  exterior: MeshStandardMaterial;
  ceiling: MeshStandardMaterial;
  terrace: MeshStandardMaterial;
  path: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  glassLit: MeshStandardMaterial;
  frame: MeshStandardMaterial;
  doorLeaf: MeshStandardMaterial;
  ground: MeshStandardMaterial;
  surroundings: MeshStandardMaterial;
  trunk: MeshStandardMaterial;
  leaves: MeshStandardMaterial;
  leavesDark: MeshStandardMaterial;
  hedge: MeshStandardMaterial;
  kerb: MeshStandardMaterial;
  trim: MeshStandardMaterial;
  sill: MeshStandardMaterial;
  plinth: MeshStandardMaterial;
  fabric: MeshStandardMaterial;
  fascia: MeshStandardMaterial;
  metal: MeshStandardMaterial;
  lamp: MeshStandardMaterial;
  lampLit: MeshStandardMaterial;
  water: MeshStandardMaterial;
  poolTiles: MeshStandardMaterial;
  woodBeam: MeshStandardMaterial;
  gravel: MeshStandardMaterial;
  solar: MeshStandardMaterial;
}

/**
 * PBR material from a photographic texture set, recolored so that its average
 * matches `color` (the material color stays editable), or a plain material.
 */
export const createPhotoMaterial = (photo: PhotoSet | null, color: string, roughness: number, extra: Partial<MeshStandardMaterial> = {}) =>
  new MeshStandardMaterial({
    color: photo ? tintFor(color, photo) : new Color(color),
    ...(photo
      ? {
          ...(photo.map ? { map: photo.map } : {}),
          normalMap: photo.normalMap,
          normalScale: new Vector2(photo.normalStrength, photo.normalStrength),
          roughnessMap: photo.roughnessMap,
          // Rough maps hold the variation; the library roughness scales them.
          roughness: Math.min(1.4, roughness / 0.75),
        }
      : { roughness }),
    metalness: 0.02,
    envMapIntensity: 0.7,
    ...extra,
  });

/** Builds Three.js materials (photographic PBR textures) from the plan's library; disposed on change. */
export const useSceneMaterials = (materials: Material[], frameColor = "#2b2f36"): SceneMaterials => {
  const photos = usePhotoTextures();
  const scene = useMemo<SceneMaterials>(() => {
    const standard = (color: string, roughness: number, photo?: PhotoKey, extra: Partial<MeshStandardMaterial> = {}) =>
      createPhotoMaterial(photo ? photos[photo] : null, color, roughness, extra);
    return {
      photos,
      byId: new Map(materials.map((material) => [material.id, standard(material.color, material.roughness, photoForMaterial(material))])),
      wall: standard("#f1f0ec", 0.9, "plaster"),
      floor: standard("#b0a79b", 0.7, "concrete"),
      roof: standard("#505a6b", 0.75, "slateTiles", { side: DoubleSide }),
      exterior: standard("#f1f0ec", 0.9, "plaster"),
      ceiling: standard("#f7f6f2", 0.95, "plaster"),
      terrace: standard("#d6d2ca", 0.9, "patio"),
      path: standard("#c9c3b8", 0.9, "patio"),
      glass: standard("#cfe2f0", 0.05, undefined, { transparent: true, opacity: 0.22, metalness: 0.1, side: DoubleSide, envMapIntensity: 0.45 }),
      glassLit: standard("#ffd9a8", 0.1, undefined, { transparent: true, opacity: 0.55, metalness: 0.2, side: DoubleSide, emissive: new Color("#ffb766"), emissiveIntensity: 1.6 }),
      frame: standard(frameColor, 0.45, undefined, { metalness: 0.35 }),
      doorLeaf: standard("#6b4a2e", 0.6, "cladding"),
      // Lawns are matte: no sky reflection at grazing angles.
      ground: standard("#5f8a3e", 1, "grass", { envMapIntensity: 0.25 }),
      surroundings: standard("#7f9a5f", 1, "grass", { envMapIntensity: 0.1 }),
      trunk: standard("#6b4a2e", 0.9),
      leaves: standard("#4f8a3c", 0.9),
      leavesDark: standard("#3d7030", 0.9),
      hedge: standard("#355f2b", 0.95, "grass"),
      kerb: standard("#a8a49c", 0.9),
      trim: standard("#f7f7f5", 0.6),
      sill: standard("#d9d5cc", 0.7),
      plinth: standard("#8d8a84", 0.95, "concrete"),
      fabric: standard("#e9e5dc", 1, "linen"),
      fascia: standard("#2f3338", 0.55),
      metal: standard("#b8bcc0", 0.3, undefined, { metalness: 0.85 }),
      lamp: standard("#e9e4da", 0.8, undefined, { side: DoubleSide }),
      lampLit: standard("#fff1dc", 0.8, undefined, { side: DoubleSide, emissive: new Color("#ffd2a0"), emissiveIntensity: 2.6 }),
      water: standard("#2b94c9", 0.06, undefined, { metalness: 0.15, envMapIntensity: 1.1 }),
      poolTiles: standard("#9fd3e6", 0.35, "whiteTiles"),
      woodBeam: standard("#8b6a45", 0.8, "cladding"),
      gravel: standard("#b5aea0", 0.95, "gravel"),
      solar: standard("#101c3a", 0.18, undefined, { metalness: 0.75, envMapIntensity: 1.6 }),
    };
  }, [materials, photos, frameColor]);

  useEffect(
    () => () => {
      scene.byId.forEach((material) => material.dispose());
      for (const key of Object.keys(scene) as (keyof SceneMaterials)[]) {
        const material = scene[key];
        if (material instanceof MeshStandardMaterial) material.dispose();
      }
    },
    [scene],
  );

  return scene;
};

export const pickMaterial = (scene: SceneMaterials, materialId: string | null | undefined, fallback: MeshStandardMaterial): MeshStandardMaterial =>
  (materialId ? scene.byId.get(materialId) : undefined) ?? fallback;

/** Roof materials need both faces rendered: clone the library material with DoubleSide. */
export const useRoofMaterial = (scene: SceneMaterials, materialId: string | null): MeshStandardMaterial => {
  const material = useMemo(() => {
    const source = pickMaterial(scene, materialId, scene.roof);
    if (source === scene.roof) return source;
    const clone = source.clone();
    clone.side = DoubleSide;
    return clone;
  }, [scene, materialId]);
  useEffect(() => () => {
    if (material !== scene.roof) material.dispose();
  }, [material, scene.roof]);
  return material;
};

/**
 * Box geometries map their UVs 0..1 per face, so a textured slab needs its own
 * texture repeat: clone the material and its map for the given footprint.
 */
export const useTiledMaterial = (base: MeshStandardMaterial, width: number, depth: number): MeshStandardMaterial => {
  const material = useMemo(() => {
    const reference = base.map ?? base.normalMap;
    if (!reference) return base;
    const clone = base.clone();
    const scale = 1 / reference.repeat.x;
    const repeatX = Math.max(0.01, width / scale);
    const repeatY = Math.max(0.01, depth / scale);
    const retile = (texture: Texture) => {
      const copy = texture.clone();
      copy.repeat.set(repeatX, repeatY);
      copy.needsUpdate = true;
      return copy;
    };
    if (base.map) clone.map = retile(base.map);
    if (base.normalMap) clone.normalMap = retile(base.normalMap);
    if (base.roughnessMap) clone.roughnessMap = retile(base.roughnessMap);
    return clone;
  }, [base, width, depth]);
  useEffect(() => () => {
    if (material !== base) {
      material.map?.dispose();
      material.normalMap?.dispose();
      material.roughnessMap?.dispose();
      material.dispose();
    }
  }, [material, base]);
  return material;
};

