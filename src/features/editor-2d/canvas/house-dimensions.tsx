"use client";

import type { Bounds } from "@/domain/plan/geometry";
import { DimensionLine } from "@/features/editor-2d/canvas/annotation-shape";

interface HouseDimensionsProps {
  bounds: Bounds;
}

/** Overall width and depth of a floor, dimensioned above and to the left of it. */
export const HouseDimensions = ({ bounds }: HouseDimensionsProps) => (
  <>
    <DimensionLine start={{ x: bounds.minX, y: bounds.minY - 0.9 }} end={{ x: bounds.maxX, y: bounds.minY - 0.9 }} />
    <DimensionLine start={{ x: bounds.minX - 0.9, y: bounds.maxY }} end={{ x: bounds.minX - 0.9, y: bounds.minY }} />
  </>
);
