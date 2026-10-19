import { DEFAULT_MATERIAL_SEEDS } from "./factory";
import { createId } from "./ids";
import type { Material, Plan, RoofType } from "./schema";

export const STYLE_PRESET_KEYS = ["modern", "classic", "minimal"] as const;
export type StylePresetKey = (typeof STYLE_PRESET_KEYS)[number];

export interface StylePreset {
  key: StylePresetKey;
  label: string;
  description: string;
  roofType: RoofType;
  roofPitch: number;
  /** Keys of DEFAULT_MATERIAL_SEEDS. */
  facade: string;
  roof: string;
  floor: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  { key: "modern", label: "Moderne", description: "Toit terrasse, façade blanche, béton ciré", roofType: "flat", roofPitch: 30, facade: "exterior-white", roof: "gravel-roof", floor: "polished-concrete" },
  { key: "classic", label: "Classique", description: "Toit à deux pans en tuiles, enduit beige, parquet", roofType: "gable", roofPitch: 35, facade: "exterior-beige", roof: "clay-roof", floor: "oak-parquet" },
  { key: "minimal", label: "Minimaliste", description: "Toit à quatre pans à faible pente, blanc, carrelage clair", roofType: "hip", roofPitch: 18, facade: "exterior-white", roof: "slate-roof", floor: "white-tiles" },
];

const seedColor = (seedKey: string): string => DEFAULT_MATERIAL_SEEDS.find((seed) => seed.key === seedKey)?.color ?? "#cccccc";

/** Colors used to preview a preset (façade, roof, floor). */
export const presetSwatches = (preset: StylePreset): [string, string, string] => [seedColor(preset.facade), seedColor(preset.roof), seedColor(preset.floor)];

/**
 * Applies a preset to the whole house: roof shape, façade, roof and floor
 * materials. Materials are looked up by name in the project library and
 * created from the default seeds when missing, so a preset never breaks a
 * project whose library was customised.
 */
export const applyStylePreset = (plan: Plan, key: StylePresetKey): Plan => {
  const preset = STYLE_PRESETS.find((candidate) => candidate.key === key);
  if (!preset) return plan;
  const materials = [...plan.materials];
  const ensure = (seedKey: string): Material => {
    const seed = DEFAULT_MATERIAL_SEEDS.find((candidate) => candidate.key === seedKey);
    if (!seed) throw new Error(`Unknown material seed "${seedKey}"`);
    const existing = materials.find((material) => material.name === seed.name && material.kind === seed.kind);
    if (existing) return existing;
    const created: Material = { id: createId(), name: seed.name, kind: seed.kind, color: seed.color, roughness: seed.roughness };
    materials.push(created);
    return created;
  };
  const facade = ensure(preset.facade);
  const roof = ensure(preset.roof);
  const floor = ensure(preset.floor);
  return {
    ...plan,
    materials,
    settings: { ...plan.settings, roofType: preset.roofType, roofPitch: preset.roofPitch, exteriorMaterialId: facade.id, roofMaterialId: roof.id },
    floors: plan.floors.map((item) => ({ ...item, rooms: item.rooms.map((room) => ({ ...room, floorMaterialId: floor.id })) })),
  };
};
