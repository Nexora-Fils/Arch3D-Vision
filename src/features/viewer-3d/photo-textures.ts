"use client";

import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import { Color, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

/**
 * Photographic PBR texture sets (CC0, Poly Haven, see src/assets/images/LICENSES.md)
 * served from public/textures. `scale` is the real-world size in meters
 * covered by one repetition of the texture.
 */
export const PHOTO_TEXTURES = {
  laminate: { dir: "laminate_floor_02", scale: 2.2, normal: 0.8 },
  deck: { dir: "wood_floor_deck", scale: 2, normal: 1 },
  cladding: { dir: "brown_planks_05", scale: 2, normal: 1 },
  plaster: { dir: "white_plaster_02", scale: 3, normal: 0.35, colorMap: false },
  sandstone: { dir: "large_sandstone_blocks_01", scale: 1.6, normal: 1.2 },
  slateTiles: { dir: "grey_roof_tiles_02", scale: 1.6, normal: 1 },
  shingles: { dir: "roof_slates_02", scale: 1.6, normal: 1 },
  clayTiles: { dir: "clay_roof_tiles", scale: 2, normal: 1 },
  concrete: { dir: "concrete_floor_02", scale: 3, normal: 0.5 },
  patio: { dir: "patio_tiles", scale: 2.4, normal: 0.8 },
  whiteTiles: { dir: "long_white_tiles", scale: 1.2, normal: 0.7 },
  greyTiles: { dir: "large_grey_tiles", scale: 2, normal: 0.8 },
  grass: { dir: "leafy_grass", scale: 3, normal: 0.8 },
  gravel: { dir: "gravel_floor_02", scale: 2, normal: 1 },
  linen: { dir: "rough_linen", scale: 0.6, normal: 0.6 },
} as const;

export type PhotoKey = keyof typeof PHOTO_TEXTURES;

export interface PhotoSet {
  key: PhotoKey;
  /** Null when only the relief is used (painted surfaces keep a uniform color). */
  map: Texture | null;
  normalMap: Texture;
  roughnessMap: Texture;
  normalStrength: number;
  /** Average albedo of the diffuse map, in linear space (used to recolor it). */
  average: Color;
}

const PHOTO_KEYS = Object.keys(PHOTO_TEXTURES) as PhotoKey[];
const MAPS = ["diff", "nor", "rough"] as const;
const PHOTO_URLS = PHOTO_KEYS.flatMap((key) => MAPS.map((map) => `/textures/${PHOTO_TEXTURES[key].dir}/${map}.jpg`));

/** Mean color of an image, sampled on a small canvas and converted to linear space. */
const averageColor = (image: CanvasImageSource): Color => {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const color = new Color(0.5, 0.5, 0.5);
  if (!context) return color;
  context.drawImage(image, 0, 0, size, size);
  const { data } = context.getImageData(0, 0, size, size);
  let r = 0;
  let g = 0;
  let b = 0;
  const sample = new Color();
  for (let index = 0; index < data.length; index += 4) {
    sample.setRGB(data[index] / 255, data[index + 1] / 255, data[index + 2] / 255, SRGBColorSpace);
    r += sample.r;
    g += sample.g;
    b += sample.b;
  }
  const count = data.length / 4;
  return color.setRGB(r / count, g / count, b / count);
};

/** Loads every photographic texture once (suspends until ready) and prepares wrapping, scale and averages. */
export const usePhotoTextures = (): Record<PhotoKey, PhotoSet> => {
  const textures = useTexture(PHOTO_URLS);
  return useMemo(() => {
    const library = {} as Record<PhotoKey, PhotoSet>;
    PHOTO_KEYS.forEach((key, index) => {
      const [map, normalMap, roughnessMap] = textures.slice(index * 3, index * 3 + 3);
      const { scale, normal } = PHOTO_TEXTURES[key];
      for (const texture of [map, normalMap, roughnessMap]) {
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.anisotropy = 8;
        texture.repeat.set(1 / scale, 1 / scale);
        texture.needsUpdate = true;
      }
      map.colorSpace = SRGBColorSpace;
      const usesColor = !("colorMap" in PHOTO_TEXTURES[key]);
      library[key] = {
        key,
        map: usesColor ? map : null,
        normalMap,
        roughnessMap,
        normalStrength: normal,
        average: usesColor ? averageColor(map.image as CanvasImageSource) : new Color(1, 1, 1),
      };
    });
    return library;
  }, [textures]);
};

/**
 * Multiplier that makes the photo's average color match `hex` while keeping
 * its own detail (grain, joints, stains).
 */
export const tintFor = (hex: string, photo: PhotoSet): Color => {
  const target = new Color(hex);
  const clampChannel = (value: number) => Math.min(3, Math.max(0.05, value));
  return new Color(
    clampChannel(target.r / Math.max(0.02, photo.average.r)),
    clampChannel(target.g / Math.max(0.02, photo.average.g)),
    clampChannel(target.b / Math.max(0.02, photo.average.b)),
  );
};
