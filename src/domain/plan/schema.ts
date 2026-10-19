import { z } from "zod";

/**
 * Single source of truth for the plan model.
 * Every length is expressed in METERS, every angle in degrees.
 * The 2D editor converts to pixels, the 3D engine converts to scene units.
 */

const meters = z.number().finite();
const positiveMeters = meters.positive();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue");
const id = z.string().min(1);

export const ROOM_TYPES = [
  "living",
  "kitchen",
  "bedroom",
  "bathroom",
  "toilet",
  "hallway",
  "office",
  "storage",
  "garage",
  "terrace",
  "pool",
  "carport",
  "other",
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const WALL_SIDES = ["north", "east", "south", "west"] as const;
export type WallSide = (typeof WALL_SIDES)[number];

export const MATERIAL_KINDS = ["wall", "floor", "roof", "exterior"] as const;
export type MaterialKind = (typeof MATERIAL_KINDS)[number];

export const FURNITURE_TYPES = [
  "bed",
  "sofa",
  "table",
  "chair",
  "wardrobe",
  "kitchen",
  "bathtub",
  "toilet",
  "desk",
  "stairs",
  "tv",
  "plant",
  "armchair",
  "shower",
  "washbasin",
  "lamp",
  "rug",
  "artwork",
  "stool",
  "umbrella",
  "coffee_table",
] as const;
export type FurnitureType = (typeof FURNITURE_TYPES)[number];

export const ROOF_TYPES = ["gable", "hip", "flat"] as const;
export type RoofType = (typeof ROOF_TYPES)[number];

export const DOOR_TYPES = ["standard", "opening", "sliding"] as const;
export type DoorType = (typeof DOOR_TYPES)[number];

export const vec2Schema = z.object({ x: meters, y: meters });
export type Vec2 = z.infer<typeof vec2Schema>;

export const materialSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  kind: z.enum(MATERIAL_KINDS),
  color,
  roughness: z.number().min(0).max(1),
});
export type Material = z.infer<typeof materialSchema>;

export const roomSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  type: z.enum(ROOM_TYPES),
  x: meters,
  y: meters,
  width: positiveMeters,
  depth: positiveMeters,
  polygon: z.array(vec2Schema).nullable().optional(),
  floorMaterialId: id.nullable(),
});
export type Room = z.infer<typeof roomSchema>;

export const wallSchema = z.object({
  id,
  roomId: id.nullable(),
  side: z.enum(WALL_SIDES).nullable(),
  start: vec2Schema,
  end: vec2Schema,
  thickness: positiveMeters,
  height: positiveMeters,
  materialId: id.nullable(),
});
export type Wall = z.infer<typeof wallSchema>;

export const doorSchema = z.object({
  id,
  wallId: id,
  offset: meters.nonnegative(),
  width: positiveMeters,
  height: positiveMeters,
  type: z.enum(DOOR_TYPES),
  swing: z.enum(["left", "right"]),
});
export type Door = z.infer<typeof doorSchema>;

export const windowSchema = z.object({
  id,
  wallId: id,
  offset: meters.nonnegative(),
  width: positiveMeters,
  height: positiveMeters,
  sillHeight: meters.nonnegative(),
});
export type Window = z.infer<typeof windowSchema>;

export const furnitureSchema = z.object({
  id,
  type: z.enum(FURNITURE_TYPES),
  x: meters,
  y: meters,
  rotation: z.number().finite(),
  width: positiveMeters,
  depth: positiveMeters,
  height: positiveMeters,
  color,
});
export type Furniture = z.infer<typeof furnitureSchema>;

export const ANNOTATION_KINDS = ["text", "dimension"] as const;
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number];

/** Free text label (start only) or dimension line (start → end, length computed). */
export const annotationSchema = z.object({
  id,
  kind: z.enum(ANNOTATION_KINDS),
  start: vec2Schema,
  end: vec2Schema,
  text: z.string().max(80),
});
export type Annotation = z.infer<typeof annotationSchema>;

export const floorSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  level: z.number().int(),
  height: positiveMeters,
  rooms: z.array(roomSchema),
  walls: z.array(wallSchema),
  doors: z.array(doorSchema),
  windows: z.array(windowSchema),
  furniture: z.array(furnitureSchema),
  annotations: z.array(annotationSchema).default([]),
});
export type Floor = z.infer<typeof floorSchema>;

export const planSettingsSchema = z.object({
  roofType: z.enum(ROOF_TYPES),
  roofPitch: z.number().min(5).max(60),
  roofOverhang: meters.nonnegative(),
  roofMaterialId: id.nullable(),
  exteriorMaterialId: id.nullable(),
  defaultWallHeight: positiveMeters,
  defaultWallThickness: positiveMeters,
  /** Photovoltaic panels on the roof (rendered on the sunny slope). */
  solarPanels: z.boolean().default(false),
  /** Window and door frames (aluminium color). */
  frameColor: color.default("#2b2f36"),
});
export type PlanSettings = z.infer<typeof planSettingsSchema>;

export const lotSchema = z.object({ width: positiveMeters, depth: positiveMeters });
export type Lot = z.infer<typeof lotSchema>;

export const planSchema = z.object({
  id,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable(),
  slug: z.string().nullable(),
  lot: lotSchema,
  settings: planSettingsSchema,
  materials: z.array(materialSchema),
  floors: z.array(floorSchema).min(1),
});
export type Plan = z.infer<typeof planSchema>;

/** Payload accepted when creating a project from the UI. */
export const createProjectInputSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(120),
  description: z.string().trim().max(2000).optional(),
  lotWidth: z.coerce.number().positive("Largeur invalide").max(500),
  lotDepth: z.coerce.number().positive("Profondeur invalide").max(500),
  wallHeight: z.coerce.number().min(2).max(6),
});
export type CreateProjectInput = z.infer<typeof createProjectInputSchema>;
