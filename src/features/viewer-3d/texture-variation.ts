import type { Material, WebGLProgramParametersWithUniforms } from "three";

/**
 * "tint": low-frequency brightness variation only, safe for regular patterns
 * (tiles, planks, stones) whose joints must not double.
 * "blend": also mixes the texture with a second, larger-scale sample of
 * itself, which hides the repetition of irregular surfaces (grass, concrete,
 * gravel, render).
 */
export type VariationMode = "tint" | "blend";

export interface TextureVariation {
  mode: VariationMode;
  /** Relative brightness amplitude (0.08 = ±8 %). */
  strength: number;
}

const NOISE = /* glsl */ `
float variationHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float variationNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(variationHash(i), variationHash(i + vec2(1.0, 0.0)), u.x), mix(variationHash(i + vec2(0.0, 1.0)), variationHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float macroVariation(vec2 p) {
  return variationNoise(p) * 0.65 + variationNoise(p * 2.7 + 11.3) * 0.35;
}
uniform float variationStrength;
`;

// UVs include the texture repeat, so 1 unit = one repetition of the photo.
const MAP_CHUNK = /* glsl */ `
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D(map, vMapUv);
  #ifdef VARIATION_BLEND
    vec4 largerSample = texture2D(map, vMapUv * 0.43 + vec2(0.37, 0.71));
    sampledDiffuseColor = mix(sampledDiffuseColor, largerSample, smoothstep(0.3, 0.7, macroVariation(vMapUv * 0.19 + 3.1)));
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif
#if defined(USE_MAP)
  vec2 variationUv = vMapUv;
#elif defined(USE_NORMALMAP)
  vec2 variationUv = vNormalMapUv;
#elif defined(USE_ROUGHNESSMAP)
  vec2 variationUv = vRoughnessMapUv;
#else
  vec2 variationUv = vec2(0.0);
#endif
diffuseColor.rgb *= 1.0 + variationStrength * (macroVariation(variationUv * 0.14) - 0.5) * 2.0;
`;

/**
 * Breaks the visible tiling of photographic textures on large surfaces. The
 * settings live in userData so clones (which do not copy onBeforeCompile)
 * can be patched again with applyTextureVariation(clone).
 */
export const applyTextureVariation = <T extends Material>(material: T, variation: TextureVariation | null = (material.userData.variation as TextureVariation | undefined) ?? null): T => {
  if (!variation) return material;
  material.userData.variation = variation;
  material.defines = { ...material.defines, ...(variation.mode === "blend" ? { VARIATION_BLEND: "" } : {}) };
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.variationStrength = { value: variation.strength };
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${NOISE}`).replace("#include <map_fragment>", MAP_CHUNK);
  };
  material.customProgramCacheKey = () => `variation-${variation.mode}`;
  material.needsUpdate = true;
  return material;
};

/** Material.clone() drops onBeforeCompile: clone and re-apply the texture variation. */
export const cloneWithVariation = <T extends Material>(material: T): T => applyTextureVariation(material.clone() as T);
