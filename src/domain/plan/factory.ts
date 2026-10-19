import { createId } from "./ids";
import type { CreateProjectInput, Material, Plan, PlanSettings } from "./schema";

export const DEFAULT_WALL_THICKNESS = 0.15;
export const DEFAULT_EXTERIOR_WALL_THICKNESS = 0.3;

interface MaterialSeed extends Omit<Material, "id"> {
  key: string;
}

export const DEFAULT_MATERIAL_SEEDS: MaterialSeed[] = [
  { key: "interior-white", name: "Mur intérieur blanc", kind: "wall", color: "#f4f4f2", roughness: 0.9 },
  { key: "interior-sand", name: "Mur sable", kind: "wall", color: "#e8dcc8", roughness: 0.9 },
  { key: "interior-grey", name: "Mur gris perle", kind: "wall", color: "#d9d9d6", roughness: 0.9 },
  { key: "interior-blue", name: "Mur bleu nuit", kind: "wall", color: "#3b4a6b", roughness: 0.9 },
  { key: "interior-anthracite", name: "Mur anthracite", kind: "wall", color: "#2b2f36", roughness: 0.85 },
  { key: "exterior-beige", name: "Enduit beige", kind: "exterior", color: "#d8c7aa", roughness: 0.9 },
  { key: "exterior-white", name: "Enduit blanc", kind: "exterior", color: "#f3f2ee", roughness: 0.85 },
  { key: "exterior-grey", name: "Enduit gris", kind: "exterior", color: "#b9b7b1", roughness: 0.9 },
  { key: "wood-cladding", name: "Bardage bois", kind: "exterior", color: "#a0683f", roughness: 0.8 },
  { key: "stone-cladding", name: "Parement pierre", kind: "exterior", color: "#cbbca3", roughness: 0.9 },
  { key: "oak-parquet", name: "Parquet chêne", kind: "floor", color: "#b98a5a", roughness: 0.7 },
  { key: "grey-tiles", name: "Carrelage gris", kind: "floor", color: "#9aa3ad", roughness: 0.5 },
  { key: "white-tiles", name: "Carrelage blanc", kind: "floor", color: "#e6e8eb", roughness: 0.4 },
  { key: "polished-concrete", name: "Béton ciré", kind: "floor", color: "#b8b4ad", roughness: 0.55 },
  { key: "deck-wood", name: "Lames de terrasse", kind: "floor", color: "#a07c55", roughness: 0.8 },
  { key: "stone-tiles", name: "Pierre naturelle", kind: "floor", color: "#c9bfae", roughness: 0.75 },
  { key: "slate-roof", name: "Toiture ardoise", kind: "roof", color: "#505a6b", roughness: 0.75 },
  { key: "clay-roof", name: "Toiture tuile", kind: "roof", color: "#9a4d2b", roughness: 0.8 },
  { key: "gravel-roof", name: "Toit terrasse gravillonné", kind: "roof", color: "#9a9a94", roughness: 0.95 },
  { key: "dark-tiles-roof", name: "Tuiles anthracite", kind: "roof", color: "#3a3d42", roughness: 0.7 },
];

/** Creates the default material set; `idFor` lets callers use deterministic ids. */
export const createDefaultMaterials = (idFor: (key: string) => string = () => createId()): Material[] =>
  DEFAULT_MATERIAL_SEEDS.map(({ key, ...material }) => ({ id: idFor(key), ...material }));

export const materialByKind = (materials: Material[], kind: Material["kind"]): Material | undefined =>
  materials.find((material) => material.kind === kind);

export const createDefaultSettings = (materials: Material[], wallHeight: number): PlanSettings => ({
  roofType: "gable",
  roofPitch: 30,
  roofOverhang: 0.4,
  roofMaterialId: materialByKind(materials, "roof")?.id ?? null,
  exteriorMaterialId: materialByKind(materials, "exterior")?.id ?? null,
  defaultWallHeight: wallHeight,
  defaultWallThickness: DEFAULT_WALL_THICKNESS,
  solarPanels: false,
  frameColor: "#2b2f36",
});

export const createEmptyPlan = (input: CreateProjectInput): Plan => {
  const materials = createDefaultMaterials();
  return {
    id: createId(),
    name: input.name,
    description: input.description?.trim() ? input.description.trim() : null,
    slug: null,
    lot: { width: input.lotWidth, depth: input.lotDepth },
    settings: createDefaultSettings(materials, input.wallHeight),
    materials,
    floors: [
      {
        id: createId(),
        name: "Rez-de-chaussée",
        level: 0,
        height: input.wallHeight,
        rooms: [],
        walls: [],
        doors: [],
        windows: [],
        furniture: [],
        annotations: [],
      },
    ],
  };
};

export const floorNameForLevel = (level: number): string => {
  if (level === 0) return "Rez-de-chaussée";
  if (level < 0) return `Sous-sol ${-level}`;
  return level === 1 ? "1er étage" : `${level}e étage`;
};
