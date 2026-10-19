"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, type ComponentRef } from "react";
import { Vector3 } from "three";
import { floorBounds } from "@/domain/plan/geometry";
import type { Plan } from "@/domain/plan/schema";
import { floorBaseHeight, toScene } from "@/features/viewer-3d/convert";
import { HouseModel } from "@/features/viewer-3d/house-model";
import { preloadScannedModels } from "@/features/viewer-3d/scanned-model";
import { SceneEffects } from "@/features/viewer-3d/scene-effects";
import { SceneEnvironment } from "@/features/viewer-3d/scene-environment";
import { usePlanStore } from "@/store/plan-store";
import { resolveQuality, useViewerStore, type CameraPreset } from "@/store/viewer-store";

type OrbitControlsRef = ComponentRef<typeof OrbitControls>;

preloadScannedModels();

export const ViewerCanvas = () => {
  const plan = usePlanStore((state) => state.plan);
  const showRoof = useViewerStore((state) => state.showRoof);
  const timeOfDay = useViewerStore((state) => state.timeOfDay);
  const hiddenFloorIds = useViewerStore((state) => state.hiddenFloorIds);
  const quality = resolveQuality(useViewerStore((state) => state.quality));
  const autoRotate = useViewerStore((state) => state.autoRotate);
  const controlsRef = useRef<OrbitControlsRef>(null);
  if (!plan) return null;
  return (
    <Canvas
      frameloop={autoRotate ? "always" : "demand"}
      shadows="percentage"
      dpr={quality === "high" ? [1, 2] : [1, 1.25]}
      camera={{ position: [22, 12, 24], fov: 42, near: 0.1, far: 1000 }}
      gl={{ antialias: quality !== "high", preserveDrawingBuffer: true, powerPreference: "high-performance" }}
    >
      <SceneEnvironment timeOfDay={timeOfDay} quality={quality} shadowSize={Math.max(plan.lot.width, plan.lot.depth)} />
      <Suspense fallback={null}>
        <HouseModel plan={plan} showRoof={showRoof} hiddenFloorIds={hiddenFloorIds} mode="orbit" timeOfDay={timeOfDay} quality={quality} />
      </Suspense>
      <OrbitControls ref={controlsRef} makeDefault autoRotate={autoRotate} autoRotateSpeed={0.5} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2 - 0.02} minDistance={2} maxDistance={150} />
      <CameraRig plan={plan} controlsRef={controlsRef} />
      {quality === "high" ? <SceneEffects /> : null}
    </Canvas>
  );
};

interface HouseFrame {
  center: Vector3;
  radius: number;
}

const houseFrame = (plan: Plan): HouseFrame => {
  const bounds = plan.floors.map((floor) => floorBounds(floor, { indoorOnly: true })).filter((item) => item !== null);
  const topIndex = plan.floors.length - 1;
  const height = topIndex >= 0 ? floorBaseHeight(plan, topIndex) + plan.floors[topIndex].height : 3;
  if (bounds.length === 0) {
    return { center: new Vector3(0, 1, 0), radius: Math.max(plan.lot.width, plan.lot.depth) / 2 };
  }
  const minX = Math.min(...bounds.map((item) => item.minX));
  const minY = Math.min(...bounds.map((item) => item.minY));
  const maxX = Math.max(...bounds.map((item) => item.maxX));
  const maxY = Math.max(...bounds.map((item) => item.maxY));
  const [x, z] = toScene({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, plan.lot);
  return { center: new Vector3(x, height / 2, z), radius: Math.max(maxX - minX, maxY - minY, height) };
};

/** Architectural framings: the house fills the view without being cut. */
const presetPosition = (preset: CameraPreset, frame: HouseFrame): Vector3 => {
  const { center, radius } = frame;
  const distance = radius * 1.05 + 3;
  switch (preset) {
    case "main":
      return new Vector3(center.x + distance * 0.82, Math.max(2.4, center.y + distance * 0.24), center.z + distance * 0.8);
    case "front":
      return new Vector3(center.x + distance * 0.08, Math.max(2, center.y + distance * 0.22), center.z + distance * 1.05);
    case "back":
      return new Vector3(center.x - distance * 0.08, Math.max(2, center.y + distance * 0.22), center.z - distance * 1.05);
    case "aerial":
      return new Vector3(center.x + distance * 0.2, center.y + distance * 1.35, center.z + distance * 0.35);
    case "threeQuarter":
    default:
      return new Vector3(center.x + distance * 0.75, center.y + distance * 0.55, center.z + distance * 0.75);
  }
};

/** Animates the camera toward the requested preset; the user keeps full orbit control afterwards. */
const CameraRig = ({ plan, controlsRef }: { plan: Plan; controlsRef: React.RefObject<OrbitControlsRef | null> }) => {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const cameraRequest = useViewerStore((state) => state.cameraRequest);
  const cameraPreset = useViewerStore((state) => state.cameraPreset);
  const goal = useRef<{ position: Vector3; target: Vector3; progress: number } | null>(null);
  const frame = useMemo(() => houseFrame(plan), [plan]);

  useEffect(() => {
    goal.current = { position: presetPosition(cameraPreset, frame), target: frame.center.clone(), progress: 0 };
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a request must re-run even for the same preset
  }, [cameraRequest]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.copy(frame.center);
    controls.update();
  }, [controlsRef, frame]);

  useFrame((_, delta) => {
    const current = goal.current;
    const controls = controlsRef.current;
    if (!current || !controls) return;
    current.progress = Math.min(1, current.progress + delta * 2.2);
    const alpha = 1 - Math.pow(1 - current.progress, 3);
    camera.position.lerp(current.position, alpha * 0.5);
    controls.target.lerp(current.target, alpha * 0.5);
    controls.update();
    if (current.progress >= 1) goal.current = null;
    else invalidate();
  });
  return null;
};
