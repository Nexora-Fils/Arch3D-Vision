/**
 * Detailed house models (GLB) shown in the gallery next to the editable plans.
 * They are fixed scenes made by third-party artists: they cannot be edited in
 * the 2D editor and have no floor plan, so their room counts and habitable
 * area are not known. Every figure below was measured on the scaled model.
 * Sources: Sketchfab models redistributed by the Objaverse dataset, licence
 * CC BY 4.0 (attribution required, see src/assets/images/LICENSES.md).
 */
export interface DetailedHouse {
  key: string;
  name: string;
  style: string;
  description: string;
  /** Optimized GLB (WebP textures, meshopt geometry) in public/models/houses. */
  file: string;
  /** Uniform scale from model units to meters, checked against door and storey heights. */
  metersPerUnit: number;
  /** Prefixes of meshes hidden at load (presentation plates, terrain): the app provides its own ground. */
  hiddenMeshes: string[];
  levels: number;
  /** Overall footprint measured on the scaled model, porches and terraces included (m). */
  footprint: { width: number; depth: number };
  /** Height from the ground to the top of the roof (m). */
  height: number;
  /** The model contains furnished rooms, visible through the windows. */
  hasModelledInterior: boolean;
  author: string;
  sourceUrl: string;
  license: { name: string; url: string };
}

const CC_BY = { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" };

export const DETAILED_HOUSES: DetailedHouse[] = [
  {
    key: "villa-aalsmeer",
    name: "Villa Aalsmeer",
    style: "Contemporain à pignon",
    description: "Villa néerlandaise à pignons vitrés, bardage bois vertical et brique, terrasse couverte et panneaux solaires.",
    file: "/models/houses/villa-aalsmeer.glb",
    metersPerUnit: 1,
    hiddenMeshes: ["Model_0", "Terrain"],
    levels: 2,
    footprint: { width: 21.6, depth: 11.6 },
    height: 11,
    hasModelledInterior: true,
    author: "pjotr.van.schothorst",
    sourceUrl: "https://sketchfab.com/3d-models/63bf1b1ade914643b3b866d3bbae988a",
    license: CC_BY,
  },
  {
    key: "duplex-house",
    name: "Maison jumelée en brique",
    style: "Colonial américain",
    description: "Maison à étage pour deux familles : brique et bardage à clin, volets, porches couverts et pignon en façade.",
    file: "/models/houses/duplex-house.glb",
    metersPerUnit: 0.0254,
    hiddenMeshes: [],
    levels: 2,
    footprint: { width: 10.2, depth: 16.9 },
    height: 8,
    hasModelledInterior: false,
    author: "jimbogies",
    sourceUrl: "https://sketchfab.com/3d-models/9bce4b9490ce43b18900e2e99e8ebe66",
    license: CC_BY,
  },
  {
    key: "green-residence",
    name: "Résidence en pierre",
    style: "Maison de caractère",
    description: "Maison à étage en moellons, balcons et vérandas à garde-corps, toiture métallique à quatre pans.",
    file: "/models/houses/green-residence.glb",
    metersPerUnit: 0.01,
    hiddenMeshes: [],
    levels: 2,
    footprint: { width: 13.4, depth: 14.6 },
    height: 8.8,
    hasModelledInterior: true,
    author: "Francesco Coldesina (topfrank2013)",
    sourceUrl: "https://sketchfab.com/3d-models/ec516ba32f03403f97954472c5d4b2cf",
    license: CC_BY,
  },
];

export const findDetailedHouse = (key: string): DetailedHouse | undefined => DETAILED_HOUSES.find((house) => house.key === key);
