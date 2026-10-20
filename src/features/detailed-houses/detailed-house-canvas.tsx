"use client";

import { OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import { Box3, Mesh, Vector3 } from "three";
import type { DetailedHouse } from "@/features/detailed-houses/catalog";
import { Ground } from "@/features/viewer-3d/landscape/garden";
import { SceneEffects } from "@/features/viewer-3d/scene-effects";
import { SceneEnvironment } from "@/features/viewer-3d/scene-environment";
import { useSceneMaterials } from "@/features/viewer-3d/scene-materials";
import { resolveQuality, useViewerStore } from "@/store/viewer-store";

/** Lawn around the model (m): the photographed landscape continues beyond it. */
const LAWN_MARGIN = 8;

/**
 * Real-time view of a detailed GLB house, lit like the generated houses (HDR
 * sky projected on the ground, sun aligned with the photograph, ambient
 * occlusion) so both kinds of models can be compared fairly.
 */
export const DetailedHouseCanvas = ({ house }: { house: DetailedHouse }) => {
  const timeOfDay = useViewerStore((state) => state.timeOfDay);
  const quality = resolveQuality(useViewerStore((state) => state.quality));
  const span = Math.max(house.footprint.width, house.footprint.depth);
  const distance = span * 1.3 + 5;
  return (
    <Canvas
      shadows="percentage"
      dpr={quality === "high" ? [1, 2] : [1, 1.25]}
      camera={{ position: [distance * 0.82, Math.max(3, house.height * 0.55 + distance * 0.18), distance * 0.8], fov: 42, near: 0.1, far: 1000 }}
      gl={{ antialias: quality !== "high", preserveDrawingBuffer: true, powerPreference: "high-performance" }}
    >
      <SceneEnvironment timeOfDay={timeOfDay} quality={quality} shadowSize={span} />
      <Suspense fallback={null}>
        <Surroundings house={house} quality={quality} />
        <DetailedModel house={house} />
      </Suspense>
      <OrbitControls makeDefault target={[0, house.height * 0.35, 0]} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2 - 0.03} minDistance={4} maxDistance={140} />
      {quality === "high" ? <SceneEffects /> : null}
    </Canvas>
  );
};

const Surroundings = ({ house, quality }: { house: DetailedHouse; quality: "low" | "high" }) => {
  const materials = useSceneMaterials([], "#2b2f36", quality);
  const lot = useMemo(() => ({ width: house.footprint.width + LAWN_MARGIN * 2, depth: house.footprint.depth + LAWN_MARGIN * 2 }), [house.footprint]);
  return <Ground lot={lot} materials={materials} quality={quality} />;
};

/** The GLB scaled to meters, centered on its footprint, resting on y = 0, presentation plates hidden. */
const DetailedModel = ({ house }: { house: DetailedHouse }) => {
  const { scene } = useGLTF(house.file);
  const prepared = useMemo(() => {
    const root = scene.clone(true);
    root.scale.setScalar(house.metersPerUnit);
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      if (house.hiddenMeshes.some((prefix) => object.name.startsWith(prefix))) {
        object.visible = false;
        return;
      }
      object.castShadow = true;
      object.receiveShadow = true;
    });
    root.updateMatrixWorld(true);
    const bounds = new Box3();
    root.traverse((object) => {
      if (object instanceof Mesh && object.visible) bounds.expandByObject(object);
    });
    const center = bounds.getCenter(new Vector3());
    root.position.set(-center.x, 0, -center.z);
    return root;
  }, [scene, house]);
  return <primitive object={prepared} />;
};
