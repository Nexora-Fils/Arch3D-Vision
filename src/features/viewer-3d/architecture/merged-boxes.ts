import { useEffect, useMemo } from "react";
import { Euler, Matrix4, Quaternion, Vector3, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createMetricBox } from "@/features/viewer-3d/architecture/metric-box";

export interface BoxPart {
  size: [number, number, number];
  position: [number, number, number];
  rotation?: [number, number, number];
}

/** One geometry (UVs in meters) for many boxes sharing a material: one draw call instead of one per box. */
export const mergeBoxes = (parts: BoxPart[]): BufferGeometry | null => {
  if (parts.length === 0) return null;
  const matrix = new Matrix4();
  const geometries = parts.map(({ size, position, rotation }) => {
    const box = createMetricBox(...size);
    matrix.compose(new Vector3(...position), new Quaternion().setFromEuler(new Euler(...(rotation ?? [0, 0, 0]))), new Vector3(1, 1, 1));
    box.applyMatrix4(matrix);
    return box;
  });
  const merged = mergeGeometries(geometries);
  geometries.forEach((geometry) => geometry.dispose());
  return merged;
};

/** Merged geometry of memoized parts, disposed when they change. */
export const useMergedBoxes = (parts: BoxPart[]): BufferGeometry | null => {
  const geometry = useMemo(() => mergeBoxes(parts), [parts]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
};
