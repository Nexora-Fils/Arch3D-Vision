import { habitableArea } from "./geometry";
import type { Floor, Lot, Plan, Room, Wall } from "./schema";

/** The minimum needed to draw a floor plan thumbnail (dashboard cards, minimap). */
export interface PlanPreview {
  lot: Lot;
  rooms: Pick<Room, "id" | "name" | "type" | "x" | "y" | "width" | "depth">[];
  walls: Pick<Wall, "id" | "start" | "end" | "thickness">[];
}

export const previewFromFloor = (floor: Pick<Floor, "rooms" | "walls">, lot: Lot): PlanPreview => ({
  lot,
  rooms: floor.rooms.map(({ id, name, type, x, y, width, depth }) => ({ id, name, type, x, y, width, depth })),
  walls: floor.walls.map(({ id, start, end, thickness }) => ({ id, start, end, thickness })),
});

export interface PlanStats {
  roomCount: number;
  bedrooms: number;
  bathrooms: number;
  garages: number;
  /** Habitable floor area: indoor rooms, garages excluded (terraces, pools and carports are outdoor) (m²). */
  habitableArea: number;
  lotArea: number;
}

export const statsFromRooms = (rooms: Pick<Room, "type" | "width" | "depth">[], lot: Lot): PlanStats => ({
  roomCount: rooms.length,
  bedrooms: rooms.filter((room) => room.type === "bedroom").length,
  bathrooms: rooms.filter((room) => room.type === "bathroom").length,
  garages: rooms.filter((room) => room.type === "garage").length,
  habitableArea: habitableArea(rooms),
  lotArea: lot.width * lot.depth,
});

export const planStats = (plan: Plan): PlanStats =>
  statsFromRooms(
    plan.floors.flatMap((floor) => floor.rooms),
    plan.lot,
  );

/** "4 chambres · 2 salles de bain · 1 garage · Terrain : 300 m²" */
export const formatPlanStats = (stats: PlanStats): string => {
  const parts = [
    `${stats.bedrooms} chambre${stats.bedrooms > 1 ? "s" : ""}`,
    `${stats.bathrooms} salle${stats.bathrooms > 1 ? "s" : ""} de bain`,
  ];
  if (stats.garages > 0) parts.push(`${stats.garages} garage${stats.garages > 1 ? "s" : ""}`);
  parts.push(`Terrain : ${stats.lotArea.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} m²`);
  return parts.join(" · ");
};
