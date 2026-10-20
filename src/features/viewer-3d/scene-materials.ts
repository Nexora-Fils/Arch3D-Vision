"use client";

import { useEffect, useMemo } from "react";
import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial, Vector2, type Texture, type WebGLProgramParametersWithUniforms } from "three";
import type { Material } from "@/domain/plan/schema";
import { tintFor, usePhotoTextures, type PhotoKey, type PhotoSet } from "@/features/viewer-3d/photo-textures";
import { applyTextureVariation, cloneWithVariation } from "@/features/viewer-3d/texture-variation";
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
  /** Painted exterior joinery: shutters, entrance doors of traditional houses. */
  shutter: MeshStandardMaterial;
  /** Smooth light render around openings (window surrounds) and stone sills. */
  surround: MeshStandardMaterial;
  ground: MeshStandardMaterial;
  surroundings: MeshStandardMaterial;
  bark: MeshStandardMaterial;
  kerb: MeshStandardMaterial;
  trim: MeshStandardMaterial;
  sill: MeshStandardMaterial;
  plinth: MeshStandardMaterial;
  fabric: MeshStandardMaterial;
  fascia: MeshStandardMaterial;
  soffit: MeshStandardMaterial;
  gutter: MeshStandardMaterial;
  coping: MeshStandardMaterial;
  ridgeMetal: MeshStandardMaterial;
  terracotta: MeshStandardMaterial;
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
 * Large-surface textures get a macro variation that hides their tiling.
 */
export const createPhotoMaterial = (photo: PhotoSet | null, color: string, roughness: number, extra: Partial<MeshStandardMaterial> = {}) =>
  applyTextureVariation(
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
      envMapIntensity: 0.8,
      ...extra,
    }),
    photo?.variation ?? null,
  );

/** Share of the scene behind a window that the glass dims when seen head-on (slight tint). */
const GLASS_MIN_OPACITY = 0.12;

/**
 * Window glass without a transmission pass (which re-renders the whole scene
 * every frame). Black albedo leaves only the specular reflection R·sky; the
 * opacity follows Fresnel (R ≈ 4 % head-on, 100 % at grazing angles) and the
 * color is divided by it, so the blend gives R·sky + (1 − R)·behind like real
 * glass: clear when facing it, a mirror at grazing angles, never washed out.
 * The low-quality profile keeps a cheap tinted transparency.
 */
const createGlass = (quality: "low" | "high"): MeshStandardMaterial => {
  if (quality !== "high") {
    return new MeshStandardMaterial({ color: "#cfe2f0", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25, side: DoubleSide, envMapIntensity: 0.6 });
  }
  const glass = new MeshPhysicalMaterial({ color: "#000000", metalness: 0, roughness: 0.04, ior: 1.52, specularIntensity: 1, transparent: true, side: DoubleSide, depthWrite: false });
  glass.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `float glassFresnel = 0.04 + 0.96 * pow(1.0 - saturate(abs(dot(geometryNormal, geometryViewDir))), 5.0);
      float glassAlpha = max(glassFresnel, ${GLASS_MIN_OPACITY.toFixed(2)});
      gl_FragColor = vec4(outgoingLight / glassAlpha, glassAlpha);`,
    );
  };
  glass.customProgramCacheKey = () => "fresnel-glass";
  return glass;
};

/** Builds Three.js materials (photographic PBR textures) from the plan's library; disposed on change. */
export const useSceneMaterials = (materials: Material[], frameColor = "#2b2f36", quality: "low" | "high" = "high"): SceneMaterials => {
  const photos = usePhotoTextures();
  const scene = useMemo<SceneMaterials>(() => {
    const standard = (color: string, roughness: number, photo?: PhotoKey, extra: Partial<MeshStandardMaterial> = {}) =>
      createPhotoMaterial(photo ? photos[photo] : null, color, roughness, extra);
    return {
      photos,
      byId: new Map(materials.map((material) => [material.id, standard(material.color, material.roughness, photoForMaterial(material))])),
      wall: standard("#f1f0ec", 0.9, "plaster"),
      floor: standard("#b0a79b", 0.7, "concrete"),
      roof: standard("#505a6b", 0.75, "slateTiles"),
      exterior: standard("#f1f0ec", 0.9, "plaster"),
      ceiling: standard("#f7f6f2", 0.95, "plaster"),
      terrace: standard("#d6d2ca", 0.9, "patio"),
      path: standard("#c9c3b8", 0.9, "patio"),
      glass: createGlass(quality),
      // Lit from inside in the evening: seen only from outside (single-sided plane facing out).
      glassLit: standard("#ffd9a8", 0.1, undefined, { transparent: true, opacity: 0.6, metalness: 0.2, emissive: new Color("#ffb766"), emissiveIntensity: 1.6 }),
      frame: standard(frameColor, 0.42, undefined, { metalness: 0.3 }),
      // Modern entrance door: anodized aluminium panel matching the window frames.
      doorLeaf: standard("#3a3e44", 0.45, undefined, { metalness: 0.25 }),
      shutter: standard("#7c8a83", 0.6, "cladding"),
      surround: standard("#ece6da", 0.8, "plaster"),
      // Lawns are matte: no sky reflection at grazing angles.
      ground: standard("#647f3f", 1, "grass", { envMapIntensity: 0.25 }),
      surroundings: standard("#7f9a5f", 1, "grass", { envMapIntensity: 0.1 }),
      bark: standard("#6a5a4a", 0.95, "bark"),
      kerb: standard("#b4b0a8", 0.9, "concrete"),
      trim: standard("#f7f7f5", 0.6),
      sill: standard("#d9d5cc", 0.7, "concrete"),
      plinth: standard("#8d8a84", 0.95, "concrete"),
      fabric: standard("#e9e5dc", 1, "linen"),
      fascia: standard("#2f3338", 0.55),
      soffit: standard("#efece6", 0.85, "plaster"),
      gutter: standard("#9aa0a6", 0.38, undefined, { metalness: 0.65, side: DoubleSide }),
      coping: standard("#5c6167", 0.4, undefined, { metalness: 0.6 }),
      ridgeMetal: standard("#3b3f45", 0.5, undefined, { metalness: 0.5 }),
      terracotta: standard("#a5583a", 0.85),
      metal: standard("#b8bcc0", 0.3, undefined, { metalness: 0.85 }),
      lamp: standard("#e9e4da", 0.8, undefined, { side: DoubleSide }),
      lampLit: standard("#fff1dc", 0.8, undefined, { side: DoubleSide, emissive: new Color("#ffd2a0"), emissiveIntensity: 6 }),
      water: standard("#2b94c9", 0.06, undefined, { metalness: 0.15, envMapIntensity: 1.1 }),
      poolTiles: standard("#9fd3e6", 0.35, "whiteTiles"),
      woodBeam: standard("#8b6a45", 0.8, "cladding"),
      gravel: standard("#b5aea0", 0.95, "gravel"),
      solar: standard("#101c3a", 0.18, undefined, { metalness: 0.75, envMapIntensity: 1.6 }),
    };
  }, [materials, photos, frameColor, quality]);

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

/**
 * Box geometries map their UVs 0..1 per face, so a textured slab needs its own
 * texture repeat: clone the material and its map for the given footprint.
 */
export const useTiledMaterial = (base: MeshStandardMaterial, width: number, depth: number, offsetX = 0, offsetY = 0): MeshStandardMaterial => {
  const material = useMemo(() => {
    const reference = base.map ?? base.normalMap;
    if (!reference) return base;
    const clone = cloneWithVariation(base);
    const scale = 1 / reference.repeat.x;
    const repeatX = Math.max(0.01, width / scale);
    const repeatY = Math.max(0.01, depth / scale);
    const retile = (texture: Texture) => {
      const copy = texture.clone();
      copy.repeat.set(repeatX, repeatY);
      // Offsets (meters) keep the pattern continuous across the pieces of a slab cut by a stairwell.
      copy.offset.set(offsetX / scale, offsetY / scale);
      copy.needsUpdate = true;
      return copy;
    };
    if (base.map) clone.map = retile(base.map);
    if (base.normalMap) clone.normalMap = retile(base.normalMap);
    if (base.roughnessMap) clone.roughnessMap = retile(base.roughnessMap);
    return clone;
  }, [base, width, depth, offsetX, offsetY]);
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
