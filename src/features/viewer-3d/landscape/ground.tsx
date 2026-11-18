"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture } from "three";
import type { Lot } from "@/domain/plan/schema";
import { useTiledMaterial, type SceneMaterials } from "@/features/viewer-3d/scene-materials";

/** Lawn margin around the lot that fades into the photographed ground (m). */
const LAWN_FADE = 22;

interface GroundProps {
  lot: Lot;
  materials: SceneMaterials;
  quality: "low" | "high";
}

/**
 * Lot lawn. In high quality the landscape beyond the lot is the HDR photograph
 * projected on the ground: the lawn extends past the lot and fades into it.
 * The low-quality profile (procedural sky) keeps a plain countryside plane.
 */
export const Ground = ({ lot, materials, quality }: GroundProps) => {
  const isPhotographic = quality === "high";
  const size = 1200;
  const width = lot.width + (isPhotographic ? LAWN_FADE * 2 : 0);
  const depth = lot.depth + (isPhotographic ? LAWN_FADE * 2 : 0);
  const surroundings = useTiledMaterial(materials.surroundings, size, size);
  const tiled = useTiledMaterial(materials.ground, width, depth);
  const fade = useMemo(
    () => (isPhotographic ? createFadeTexture(lot.width / width, lot.depth / depth) : null),
    [isPhotographic, lot.width, lot.depth, width, depth],
  );
  const lawn = useMemo(() => {
    if (!fade) return tiled;
    const material = tiled.clone();
    material.alphaMap = fade;
    material.transparent = true;
    return material;
  }, [tiled, fade]);
  useEffect(
    () => () => {
      fade?.dispose();
      if (lawn !== tiled) lawn.dispose();
    },
    [fade, lawn, tiled],
  );
  return (
    <group>
      {isPhotographic ? null : (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.03} receiveShadow material={surroundings}>
          <planeGeometry args={[size, size]} />
        </mesh>
      )}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow material={lawn} renderOrder={-0.5}>
        <planeGeometry args={[width, depth]} />
      </mesh>
    </group>
  );
};

/** Alpha map: opaque over the lot (inner fraction of the plane), smooth falloff to transparent at the edges. */
const createFadeTexture = (innerWidth: number, innerDepth: number): CanvasTexture => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const image = context.createImageData(size, size);
    const smooth = (t: number) => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        // Distance outside the lot, as a fraction of the margin (0 inside the lot, 1 at the plane edge).
        const u = Math.max(0, (Math.abs(x / (size - 1) - 0.5) * 2 - innerWidth) / (1 - innerWidth));
        const v = Math.max(0, (Math.abs(y / (size - 1) - 0.5) * 2 - innerDepth) / (1 - innerDepth));
        const value = Math.round(255 * (1 - smooth(Math.min(1, Math.hypot(u, v)))));
        const index = (y * size + x) * 4;
        image.data[index] = value;
        image.data[index + 1] = value;
        image.data[index + 2] = value;
        image.data[index + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }
  return new CanvasTexture(canvas);
};
