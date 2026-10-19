"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import { Box3, Group, Mesh, Vector3 } from "three";

/** Scanned CC0 models (Poly Haven), optimized to GLB in public/models. */
export const MODEL_URLS = {
  armchair: "/models/modern_arm_chair_01.glb",
  diningChair: "/models/dining_chair_02.glb",
  coffeeTable: "/models/modern_coffee_table_01.glb",
  table: "/models/wooden_table_02.glb",
  barStool: "/models/bar_chair_round_01.glb",
  plantTall: "/models/potted_plant_01.glb",
  plantWide: "/models/potted_plant_02.glb",
  succulent: "/models/potted_plant_04.glb",
  tvCabinet: "/models/modern_wooden_cabinet.glb",
  ceilingLamp: "/models/modern_ceiling_lamp_01.glb",
  vase: "/models/ceramic_vase_01.glb",
  flowers: "/models/shrub_01.glb",
  bushes: "/models/shrub_04.glb",
  tallGrass: "/models/grass_medium_01.glb",
} as const;

export type ModelKey = keyof typeof MODEL_URLS;

interface ScannedModelProps {
  model: ModelKey;
  /** Target footprint and height (meters). */
  width: number;
  depth: number;
  height: number;
  /**
   * "uniform": keep the model's proportions and fit inside the box (seats, plants).
   * "stretch": match the box exactly (tables, cabinets).
   */
  fit?: "uniform" | "stretch";
  /** Extra rotation applied before fitting, to align the model's long side with the width. */
  rotateY?: number;
}

/** A scanned model, recentered on its footprint, resting on y = 0 and sized to the plan's dimensions. */
export const ScannedModel = ({ model, width, depth, height, fit = "uniform", rotateY = 0 }: ScannedModelProps) => {
  const { scene } = useGLTF(MODEL_URLS[model]);
  const prepared = useMemo(() => {
    const root = scene.clone(true);
    root.rotation.y = rotateY;
    root.updateMatrixWorld(true);
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    root.position.set(-center.x, -box.min.y, -center.z);
    root.traverse((object) => {
      if (object instanceof Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    const wrapper = new Group();
    wrapper.add(root);
    return { wrapper, size };
  }, [scene, rotateY]);
  const { size } = prepared;
  const sx = width / Math.max(size.x, 1e-3);
  const sy = height / Math.max(size.y, 1e-3);
  const sz = depth / Math.max(size.z, 1e-3);
  const uniform = Math.min(sx, sy, sz);
  const scale: [number, number, number] = fit === "stretch" ? [sx, sy, sz] : [uniform, uniform, uniform];
  return <primitive object={prepared.wrapper} scale={scale} />;
};

/** Start downloading every model as soon as the 3D module loads. */
export const preloadScannedModels = () => {
  for (const url of Object.values(MODEL_URLS)) useGLTF.preload(url);
};
