"use client";

import { Environment, Sky, SoftShadows, useEnvironment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Vector3, type Texture } from "three";
import { GroundedSkybox } from "three/examples/jsm/objects/GroundedSkybox.js";
import type { TimeOfDay } from "@/store/viewer-store";

interface SceneEnvironmentProps {
  timeOfDay: TimeOfDay;
  shadowSize?: number;
  quality?: "low" | "high";
  /** Interiors receive more image-based light (no direct sun on most surfaces). */
  interior?: boolean;
}

interface SkySpec {
  file: string;
  /** Direction of the sun disc in the HDR image (measured on its brightest pixel), before rotation. */
  sunInImage: [number, number, number];
  /** Azimuth wanted for the sun in the scene (radians from +x toward +z): lights the faces seen by the default camera. */
  sunAzimuth: number;
  sunColor: string;
  sunIntensity: number;
  environmentIntensity: number;
  skyIntensity: number;
  exposure: number;
}

/**
 * Real outdoor HDR photographs (CC0, Poly Haven): a mown park for the day,
 * a golf course at dusk for the evening. Their lower half is
 * projected on the ground around the lot, so the horizon is a real landscape.
 */
const SKIES: Record<TimeOfDay, SkySpec> = {
  day: { file: "/hdri/je_gray_park_2k.hdr", sunInImage: [0.772, 0.295, 0.563], sunAzimuth: 1.75, sunColor: "#fff1de", sunIntensity: 2.4, environmentIntensity: 0.9, skyIntensity: 1, exposure: 1 },
  // Dusk: the sun has just set; its glow faces the default camera (house against the light, lit windows).
  evening: { file: "/hdri/sunset_fairway_2k.hdr", sunInImage: [0.888, 0.118, 0.445], sunAzimuth: 3.9, sunColor: "#ffb07a", sunIntensity: 0.55, environmentIntensity: 1, skyIntensity: 1, exposure: 0.85 },
};

/**
 * Projection height of the photograph (m). The real one (≈1.7 m) smears the
 * far ground into radial streaks when the camera orbits 10 to 30 m high; a
 * higher projection keeps the tree line as a backdrop and only magnifies the
 * near grass, which the lot lawn covers.
 */
const PHOTO_CAMERA_HEIGHT = 12;
/** The projected sky must contain every camera position (orbit max distance is 150 m). */
const SKY_RADIUS = 320;

/**
 * Rotation (around +y) that brings the photographed sun to the wanted azimuth.
 * Three.js samples the environment with the inverse rotation, so a world
 * direction w sees the image direction R(-angle)·w: the sun ends at R(angle)·sun.
 */
const skyRotation = (spec: SkySpec): number => Math.atan2(spec.sunInImage[2], spec.sunInImage[0]) - spec.sunAzimuth;

/** World-space sun direction once the sky is rotated. */
const sunDirection = (spec: SkySpec): Vector3 => {
  const [x, y, z] = spec.sunInImage;
  const angle = skyRotation(spec);
  return new Vector3(x * Math.cos(angle) + z * Math.sin(angle), y, -x * Math.sin(angle) + z * Math.cos(angle)).normalize();
};

/**
 * Image-based lighting from real HDR skies plus a shadow-casting sun aligned
 * with the sun of the photograph. The low-quality profile falls back to a
 * procedural sky and hard shadows.
 */
export const SceneEnvironment = ({ timeOfDay, shadowSize = 40, quality = "high", interior = false }: SceneEnvironmentProps) => {
  const getState = useThree((state) => state.get);
  const spec = SKIES[timeOfDay];
  const sun = useMemo(() => sunDirection(spec).multiplyScalar(80), [spec]);

  useEffect(() => {
    getState().gl.toneMappingExposure = spec.exposure;
  }, [getState, spec]);

  return (
    <>
      {quality === "high" ? (
        <PhotographicSky spec={spec} interior={interior} />
      ) : (
        <>
          <Sky sunPosition={sun.toArray()} turbidity={timeOfDay === "evening" ? 10 : 4} rayleigh={timeOfDay === "evening" ? 4 : 1.4} mieCoefficient={0.005} mieDirectionalG={0.8} distance={450000} />
          <hemisphereLight args={["#e9eef5", "#8a8f74", 1]} />
          <ambientLight intensity={0.5} color="#fff5e8" />
        </>
      )}
      {quality === "high" ? <SoftShadows size={timeOfDay === "evening" ? 16 : 10} samples={12} focus={0.5} /> : null}
      <directionalLight
        position={sun.toArray()}
        intensity={spec.sunIntensity}
        color={spec.sunColor}
        castShadow
        shadow-mapSize={quality === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.025}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-camera-left={-shadowSize}
        shadow-camera-right={shadowSize}
        shadow-camera-top={shadowSize}
        shadow-camera-bottom={-shadowSize}
      />
    </>
  );
};

const PhotographicSky = ({ spec, interior }: { spec: SkySpec; interior: boolean }) => {
  const texture = useEnvironment({ files: spec.file });
  const rotation = skyRotation(spec);
  return (
    <>
      <Environment map={texture} environmentIntensity={spec.environmentIntensity * (interior ? 1.15 : 1)} environmentRotation={[0, rotation, 0]} />
      <GroundedSky texture={texture} rotation={rotation} intensity={spec.skyIntensity} />
      {/* Indoors, light bounces off floors and walls onto the ceilings: a warm light from below stands in for it. */}
      {interior ? <hemisphereLight args={["#f4f1ea", "#efe6d8", 2]} /> : null}
    </>
  );
};

/** The HDR photograph as a dome whose lower half is flattened into a ground at y = 0. */
const GroundedSky = ({ texture, rotation, intensity }: { texture: Texture; rotation: number; intensity: number }) => {
  const skybox = useMemo(() => {
    const mesh = new GroundedSkybox(texture, PHOTO_CAMERA_HEIGHT, SKY_RADIUS);
    mesh.position.y = PHOTO_CAMERA_HEIGHT - 0.02;
    mesh.rotation.y = rotation;
    mesh.material.color.setScalar(intensity);
    // Drawn behind everything else, like a background.
    mesh.renderOrder = -1;
    return mesh;
  }, [texture, rotation, intensity]);
  useEffect(
    () => () => {
      skybox.geometry.dispose();
      skybox.material.dispose();
    },
    [skybox],
  );
  return <primitive object={skybox} />;
};
