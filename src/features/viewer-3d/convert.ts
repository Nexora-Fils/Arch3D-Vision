import type { Lot, Vec2 } from "@/domain/plan/schema";

export const EYE_HEIGHT = 1.65;

/**
 * Plan → scene conversion. The plan uses x to the right and y "down" (south);
 * the scene uses x to the right, z toward the viewer and y up. The lot is
 * centered on the origin so OrbitControls rotate around the house.
 */
export const toScene = (point: Vec2, lot: Lot): [number, number] => [point.x - lot.width / 2, point.y - lot.depth / 2];
