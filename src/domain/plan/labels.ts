import type { DoorType, FurnitureType, MaterialKind, RoofType, RoomType, WallSide } from "./schema";

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  living: "Salon",
  kitchen: "Cuisine",
  bedroom: "Chambre",
  bathroom: "Salle de bain",
  toilet: "Toilettes",
  hallway: "Couloir",
  office: "Bureau",
  storage: "Rangement",
  garage: "Garage",
  terrace: "Terrasse",
  pool: "Piscine",
  carport: "Carport",
  other: "Autre",
};

/** Fill colors used by the 2D editor to distinguish room types. */
export const ROOM_TYPE_COLORS: Record<RoomType, string> = {
  living: "#e6edf7",
  kitchen: "#f4ecdc",
  bedroom: "#ece8f3",
  bathroom: "#e0eff2",
  toilet: "#e5edf3",
  hallway: "#f1f2f4",
  office: "#e6f0e4",
  storage: "#efeeea",
  garage: "#e8e7e3",
  terrace: "#ebe5d8",
  pool: "#cfe6f2",
  carport: "#e6e2da",
  other: "#f5f6f8",
};

export const FURNITURE_TYPE_LABELS: Record<FurnitureType, string> = {
  bed: "Lit",
  sofa: "Canapé",
  table: "Table",
  chair: "Chaise",
  wardrobe: "Armoire",
  kitchen: "Plan de cuisine",
  bathtub: "Baignoire",
  toilet: "WC",
  desk: "Bureau",
  stairs: "Escalier",
  tv: "Téléviseur",
  plant: "Plante",
  armchair: "Fauteuil",
  shower: "Douche",
  washbasin: "Lavabo",
  lamp: "Lampadaire",
  rug: "Tapis",
  artwork: "Tableau",
  stool: "Tabouret",
  umbrella: "Parasol",
  coffee_table: "Table basse",
};

export interface FurniturePreset {
  width: number;
  depth: number;
  height: number;
  color: string;
}

export const FURNITURE_PRESETS: Record<FurnitureType, FurniturePreset> = {
  bed: { width: 1.6, depth: 2, height: 0.5, color: "#64748b" },
  sofa: { width: 2.2, depth: 0.9, height: 0.8, color: "#475569" },
  table: { width: 1.4, depth: 0.8, height: 0.75, color: "#8b5e3c" },
  chair: { width: 0.45, depth: 0.58, height: 0.97, color: "#4a3b33" },
  wardrobe: { width: 1.2, depth: 0.6, height: 2.1, color: "#7c5a3c" },
  kitchen: { width: 2.4, depth: 0.6, height: 0.9, color: "#e5e7eb" },
  bathtub: { width: 0.8, depth: 1.7, height: 0.55, color: "#f8fafc" },
  toilet: { width: 0.4, depth: 0.65, height: 0.8, color: "#f8fafc" },
  desk: { width: 1.2, depth: 0.6, height: 0.75, color: "#a16207" },
  stairs: { width: 0.9, depth: 3.4, height: 2.7, color: "#e8e6e1" },
  tv: { width: 1.8, depth: 0.45, height: 0.6, color: "#1f2937" },
  plant: { width: 0.5, depth: 0.5, height: 1.4, color: "#3f6b35" },
  armchair: { width: 0.82, depth: 0.99, height: 1.02, color: "#2b2f36" },
  shower: { width: 0.9, depth: 0.9, height: 2.1, color: "#e5e7eb" },
  washbasin: { width: 1.0, depth: 0.5, height: 0.85, color: "#f8fafc" },
  lamp: { width: 0.35, depth: 0.35, height: 1.6, color: "#d6d3d1" },
  rug: { width: 2.4, depth: 1.7, height: 0.02, color: "#c7b9a3" },
  artwork: { width: 1.2, depth: 0.06, height: 0.9, color: "#c2410c" },
  stool: { width: 0.48, depth: 0.49, height: 0.75, color: "#5a3b2a" },
  umbrella: { width: 2.6, depth: 2.6, height: 2.4, color: "#f5f1e8" },
  coffee_table: { width: 1.2, depth: 0.6, height: 0.39, color: "#8c8a84" },
};

export const MATERIAL_KIND_LABELS: Record<MaterialKind, string> = {
  wall: "Mur intérieur",
  floor: "Sol",
  roof: "Toiture",
  exterior: "Façade",
};

export const ROOF_TYPE_LABELS: Record<RoofType, string> = {
  gable: "Deux pans",
  hip: "Quatre pans",
  flat: "Toit plat",
};

export const WALL_SIDE_LABELS: Record<WallSide, string> = {
  north: "Nord",
  south: "Sud",
  east: "Est",
  west: "Ouest",
};

export const DOOR_TYPE_LABELS: Record<DoorType, string> = {
  standard: "Porte battante",
  opening: "Passage ouvert",
  sliding: "Baie coulissante",
};
