"use client";

import { Suspense } from "react";

import { Canvas } from "@react-three/fiber";
import type { Plan, Vec2 } from "@/domain/plan/schema";
import { HouseModel } from "@/features/viewer-3d/house-model";
import { preloadScannedModels } from "@/features/viewer-3d/scanned-model";
import { SceneEffects } from "@/features/viewer-3d/scene-effects";
import { SceneEnvironment } from "@/features/viewer-3d/scene-environment";
import { FirstPersonController } from "@/features/walkthrough/first-person-controller";
import type { WalkInput } from "@/features/walkthrough/walk-input";
import { resolveQuality, useViewerStore } from "@/store/viewer-store";

interface WalkCanvasProps {
  plan: Plan;
  /** Floor currently visited (lights are switched on there). */
  floorId: string;
  start: Vec2;
  input: WalkInput;
  onFloorChange: (floorId: string) => void;
}

preloadScannedModels();

export const WalkCanvas = ({ plan, floorId, start, input, onFloorChange }: WalkCanvasProps) => {
  const timeOfDay = useViewerStore((state) => state.timeOfDay);
  const quality = resolveQuality(useViewerStore((state) => state.quality));
  return (
    <Canvas shadows="percentage" dpr={quality === "high" ? [1, 1.5] : [1, 1]} camera={{ fov: 72, near: 0.05, far: 600 }} gl={{ antialias: quality !== "high", powerPreference: "high-performance" }}>
      <SceneEnvironment timeOfDay={timeOfDay} quality={quality} shadowSize={Math.max(plan.lot.width, plan.lot.depth)} interior />
      <Suspense fallback={null}>
        <HouseModel plan={plan} showRoof mode="walk" timeOfDay={timeOfDay} quality={quality} walkFloorId={floorId} />
      </Suspense>
      <FirstPersonController plan={plan} floorId={floorId} start={start} input={input} onFloorChange={onFloorChange} />
      {quality === "high" ? <SceneEffects interior /> : null}
    </Canvas>
  );
};
