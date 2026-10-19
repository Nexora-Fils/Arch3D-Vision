"use client";

import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

interface SceneEffectsProps {
  /** Interiors get a slightly stronger vignette to focus the eye. */
  interior?: boolean;
}

/**
 * Screen-space finishing: filmic tone mapping, a bloom restricted to emissive
 * lights (lamps, lit windows), anti-aliasing and a soft vignette. Screen-space
 * ambient occlusion was evaluated and rejected: without a denoiser it produced
 * visible grain around every edge.
 */
export const SceneEffects = ({ interior = false }: SceneEffectsProps) => (
  <EffectComposer multisampling={0}>
    <Bloom luminanceThreshold={1.5} luminanceSmoothing={0.3} intensity={0.45} mipmapBlur />
    <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    <Vignette eskil={false} offset={0.28} darkness={interior ? 0.38 : 0.28} />
    <SMAA />
  </EffectComposer>
);
