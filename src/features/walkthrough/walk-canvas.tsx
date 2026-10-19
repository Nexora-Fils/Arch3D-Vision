"use client";

import { Suspense } from "react";

import { Canvas } from "@react-three/fiber";
import type { Floor, Plan, Vec2 } from "@/domain/plan/schema";
import { floorBaseHeight } from "@/features/viewer-3d/convert";
import { HouseModel } from "@/features/viewer-3d/house-model";
import { preloadScannedModels } from "@/features/viewer-3d/scanned-model";
import { SceneEffects } from "@/features/viewer-3d/scene-effects";
import { SceneEnvironment } from "@/features/viewer-3d/scene-environment";
import { FirstPersonController } from "@/features/walkthrough/first-person-controller";
import type { WalkInput } from "@/features/walkthrough/walk-input";
import { resolveQuality, useViewerStore } from "@/store/viewer-store";

interface WalkCanvasProps {
  plan: Plan;
  floor: Floor;
  start: Vec2;
  input: WalkInput;
}

preloadScannedModels();

export const WalkCanvas = ({ plan, floor, start, input }: WalkCanvasProps) => {
  const floorIndex = Math.max(0, plan.floors.findIndex((item) => item.id === floor.id));
  const base = floorBaseHeight(plan, floorIndex);
  const timeOfDay = useViewerStore((state) => state.timeOfDay);
  const quality = resolveQuality(useViewerStore((state) => state.quality));
  return (
    <Canvas shadows="percentage" dpr={quality === "high" ? [1, 1.5] : [1, 1]} camera={{ fov: 72, near: 0.05, far: 600 }} gl={{ antialias: quality !== "high", powerPreference: "high-performance" }}>
      <SceneEnvironment timeOfDay={timeOfDay} quality={quality} shadowSize={Math.max(plan.lot.width, plan.lot.depth)} interior />
      <Suspense fallback={null}>
        <HouseModel plan={plan} showRoof mode="walk" timeOfDay={timeOfDay} quality={quality} walkFloorId={floor.id} />
      </Suspense>
      <FirstPersonController floor={floor} base={base} lot={plan.lot} start={start} input={input} />
      {quality === "high" ? <SceneEffects interior /> : null}
    </Canvas>
  );
};
