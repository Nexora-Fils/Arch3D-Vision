"use client";

import { useEffect, useState } from "react";
import { PHOTO_TEXTURES, type PhotoKey } from "@/features/viewer-3d/photo-textures";

/** Pixel width of the diffuse JPEGs in public/textures. */
export const PLAN_IMAGE_SIZE = 1024;

const cache = new Map<PhotoKey, HTMLImageElement>();

/** Loads the photographic diffuse maps once, so the 2D plan shows the same floors as the 3D house. */
export const usePlanImages = (): Partial<Record<PhotoKey, HTMLImageElement>> => {
  const [images, setImages] = useState<Partial<Record<PhotoKey, HTMLImageElement>>>(() => Object.fromEntries(cache));
  useEffect(() => {
    let isActive = true;
    for (const key of Object.keys(PHOTO_TEXTURES) as PhotoKey[]) {
      if (cache.has(key)) continue;
      const image = new Image();
      image.onload = () => {
        cache.set(key, image);
        if (isActive) setImages(Object.fromEntries(cache));
      };
      image.src = `/textures/${PHOTO_TEXTURES[key].dir}/diff.jpg`;
    }
    return () => {
      isActive = false;
    };
  }, []);
  return images;
};

/** Konva pattern scale so that one texture tile covers its real-world size (stage units are meters). */
export const patternScaleFor = (key: PhotoKey) => {
  const factor = PHOTO_TEXTURES[key].scale / PLAN_IMAGE_SIZE;
  return { x: factor, y: factor };
};
