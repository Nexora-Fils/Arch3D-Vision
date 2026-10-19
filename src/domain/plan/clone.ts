import { createId } from "./ids";
import type { Plan } from "./schema";

interface CloneOverrides {
  name: string;
  description?: string | null;
}

/**
 * Deep-copies a plan with brand new ids while keeping every internal
 * reference (walls → rooms, openings → walls, rooms/walls/settings → materials)
 * consistent. Used to start a project from a template.
 */
export const clonePlan = (plan: Plan, overrides: CloneOverrides): Plan => {
  const ids = new Map<string, string>();
  const fresh = (previous: string): string => {
    const existing = ids.get(previous);
    if (existing) return existing;
    const next = createId();
    ids.set(previous, next);
    return next;
  };
  const ref = (previous: string | null): string | null => (previous === null ? null : fresh(previous));

  return {
    id: createId(),
    name: overrides.name,
    description: overrides.description === undefined ? plan.description : overrides.description,
    slug: null,
    lot: { ...plan.lot },
    settings: {
      ...plan.settings,
      roofMaterialId: ref(plan.settings.roofMaterialId),
      exteriorMaterialId: ref(plan.settings.exteriorMaterialId),
    },
    materials: plan.materials.map((material) => ({ ...material, id: fresh(material.id) })),
    floors: plan.floors.map((floor) => ({
      ...floor,
      id: fresh(floor.id),
      rooms: floor.rooms.map((room) => ({ ...room, id: fresh(room.id), floorMaterialId: ref(room.floorMaterialId) })),
      walls: floor.walls.map((wall) => ({ ...wall, id: fresh(wall.id), roomId: ref(wall.roomId), materialId: ref(wall.materialId) })),
      doors: floor.doors.map((door) => ({ ...door, id: fresh(door.id), wallId: fresh(door.wallId) })),
      windows: floor.windows.map((window) => ({ ...window, id: fresh(window.id), wallId: fresh(window.wallId) })),
      furniture: floor.furniture.map((item) => ({ ...item, id: fresh(item.id) })),
      annotations: floor.annotations.map((annotation) => ({ ...annotation, id: fresh(annotation.id) })),
    })),
  };
};
