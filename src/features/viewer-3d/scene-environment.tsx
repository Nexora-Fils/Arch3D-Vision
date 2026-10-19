"use client";

import { Environment, Sky, SoftShadows } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import type { TimeOfDay } from "@/store/viewer-store";

interface SceneEnvironmentProps {
  timeOfDay: TimeOfDay;
  shadowSize?: number;
  quality?: "low" | "high";
  /** Show the HDR sky as background (exterior view); interiors keep it for reflections only. */
  background?: boolean;
  /** Interiors receive more image-based light (no direct sun on most surfaces). */
  interior?: boolean;
}

/** Sun directions matching the two HDR environments in public/hdri. */
const DAY_SUN: [number, number, number] = [42, 52, 28];
const EVENING_SUN: [number, number, number] = [-70, 5, 30];

/**
 * Image-based lighting from real HDR skies (CC0, Poly Haven) plus a shadow-casting
 * sun. The low-quality profile falls back to a procedural sky and hard shadows.
 */
export const SceneEnvironment = ({ timeOfDay, shadowSize = 40, quality = "high", background = true, interior = false }: SceneEnvironmentProps) => {
  const getState = useThree((state) => state.get);
  const isEvening = timeOfDay === "evening";

  useEffect(() => {
    getState().gl.toneMappingExposure = isEvening ? 1.0 : 1.05;
  }, [getState, isEvening]);

  return (
    <>
      {quality === "high" ? (
        <Environment
          files={isEvening ? "/hdri/evening_1k.hdr" : "/hdri/day_1k.hdr"}
          background={background}
          backgroundBlurriness={isEvening ? 0.45 : 0.05}
          backgroundIntensity={isEvening ? 0.85 : 0.72}
          environmentIntensity={isEvening ? 0.6 : interior ? 1.05 : 0.8}
          environmentRotation={[0, isEvening ? Math.PI * 1.25 : Math.PI * 1.15, 0]}
          backgroundRotation={[0, isEvening ? Math.PI * 1.25 : Math.PI * 1.15, 0]}
        />
      ) : (
        <Sky sunPosition={isEvening ? EVENING_SUN : DAY_SUN} turbidity={isEvening ? 10 : 4} rayleigh={isEvening ? 4 : 1.4} mieCoefficient={isEvening ? 0.03 : 0.005} mieDirectionalG={isEvening ? 0.95 : 0.8} distance={450000} />
      )}
      {quality === "high" ? <SoftShadows size={isEvening ? 18 : 12} samples={12} focus={0.4} /> : null}
      <hemisphereLight args={isEvening ? ["#8ea4d6", "#4a4552", 0.45] : ["#f1ece3", "#a8a797", quality === "high" ? 0.55 : 1.05]} />
      <ambientLight intensity={isEvening ? 0.18 : quality === "high" ? (interior ? 0.45 : 0.3) : 0.62} color={isEvening ? "#d9c4b0" : "#fff5e8"} />
      <directionalLight
        position={isEvening ? EVENING_SUN : DAY_SUN}
        intensity={isEvening ? 1.4 : 2.6}
        color={isEvening ? "#ffb784" : "#fff4e0"}
        castShadow
        shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.03}
        shadow-camera-near={1}
        shadow-camera-far={250}
        shadow-camera-left={-shadowSize}
        shadow-camera-right={shadowSize}
        shadow-camera-top={shadowSize}
        shadow-camera-bottom={-shadowSize}
      />
    </>
  );
};
