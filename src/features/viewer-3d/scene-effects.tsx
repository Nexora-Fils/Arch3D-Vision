"use client";

import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

interface SceneEffectsProps {
  /** Interiors get a tighter occlusion radius and a slightly stronger vignette. */
  interior?: boolean;
}

/**
 * Screen-space finishing for the high-quality profile: denoised ambient
 * occlusion (N8AO) grounds furniture, corners and roof edges; AgX tone mapping
 * keeps bright skies and white façades from clipping; a bloom restricted to
 * emissive lights; anti-aliasing and a soft vignette.
 */
export const SceneEffects = ({ interior = false }: SceneEffectsProps) => (
  <EffectComposer multisampling={0} enableNormalPass={false}>
    <N8AO aoRadius={interior ? 0.6 : 1.2} distanceFalloff={interior ? 0.6 : 1} intensity={interior ? 2.2 : 2.6} quality="medium" halfRes depthAwareUpsampling />
    {/* Only lamps and lit windows exceed this luminance: sunlit white façades do not glow. */}
    <Bloom luminanceThreshold={3.2} luminanceSmoothing={0.4} intensity={0.45} mipmapBlur />
    <ToneMapping mode={ToneMappingMode.AGX} />
    <Vignette eskil={false} offset={0.3} darkness={interior ? 0.32 : 0.22} />
    <SMAA />
  </EffectComposer>
);
