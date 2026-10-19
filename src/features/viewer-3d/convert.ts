import type { Lot, Plan, Vec2 } from "@/domain/plan/schema";

/** Thickness of the slab separating two levels (m). */
export const LEVEL_SLAB_THICKNESS = 0.25;
export const EYE_HEIGHT = 1.65;

/**
 * Plan → scene conversion. The plan uses x to the right and y "down" (south);
 * the scene uses x to the right, z toward the viewer and y up. The lot is
 * centered on the origin so OrbitControls rotate around the house.
 */
export const toScene = (point: Vec2, lot: Lot): [number, number] => [point.x - lot.width / 2, point.y - lot.depth / 2];

/** Elevation of a floor's finished ground, from the stacked heights of the levels below. */
export const floorBaseHeight = (plan: Plan, floorIndex: number): number =>
  plan.floors.slice(0, floorIndex).reduce((height, floor) => height + floor.height + LEVEL_SLAB_THICKNESS, 0);
