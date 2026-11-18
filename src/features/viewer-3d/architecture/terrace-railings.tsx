"use client";

import { useMemo } from "react";
import { floorBounds } from "@/domain/plan/geometry";
import type { Floor, Lot } from "@/domain/plan/schema";
import type { SceneMaterials } from "@/features/viewer-3d/scene-materials";
import { GuardRail } from "@/features/viewer-3d/stair-mesh";

interface TerraceRailingsProps {
  floor: Floor;
  nextFloor: Floor;
  top: number;
  lot: Lot;
  materials: SceneMaterials;
}

/** Glass railings along the edges of a floor that stay uncovered by the floor above (terraces). */
export const TerraceRailings = ({ floor, nextFloor, top, lot, materials }: TerraceRailingsProps) => {
  const rails = useMemo(() => {
    const lower = floorBounds(floor, { indoorOnly: true });
    const upper = floorBounds(nextFloor, { indoorOnly: true });
    if (!lower || !upper) return [];
    const items: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];
    const inset = 0.6;
    if (upper.maxY < lower.maxY - inset) {
      items.push({ start: { x: lower.minX, y: lower.maxY }, end: { x: lower.maxX, y: lower.maxY } });
      items.push({ start: { x: lower.minX, y: upper.maxY }, end: { x: lower.minX, y: lower.maxY } });
      items.push({ start: { x: lower.maxX, y: upper.maxY }, end: { x: lower.maxX, y: lower.maxY } });
    }
    if (upper.minY > lower.minY + inset) {
      items.push({ start: { x: lower.minX, y: lower.minY }, end: { x: lower.maxX, y: lower.minY } });
      items.push({ start: { x: lower.minX, y: lower.minY }, end: { x: lower.minX, y: upper.minY } });
      items.push({ start: { x: lower.maxX, y: lower.minY }, end: { x: lower.maxX, y: upper.minY } });
    }
    if (upper.maxX < lower.maxX - inset) {
      items.push({ start: { x: lower.maxX, y: lower.minY }, end: { x: lower.maxX, y: lower.maxY } });
      items.push({ start: { x: upper.maxX, y: lower.minY }, end: { x: lower.maxX, y: lower.minY } });
      items.push({ start: { x: upper.maxX, y: lower.maxY }, end: { x: lower.maxX, y: lower.maxY } });
    }
    if (upper.minX > lower.minX + inset) {
      items.push({ start: { x: lower.minX, y: lower.minY }, end: { x: lower.minX, y: lower.maxY } });
      items.push({ start: { x: lower.minX, y: lower.minY }, end: { x: upper.minX, y: lower.minY } });
      items.push({ start: { x: lower.minX, y: lower.maxY }, end: { x: upper.minX, y: lower.maxY } });
    }
    return items.filter((rail) => Math.hypot(rail.end.x - rail.start.x, rail.end.y - rail.start.y) > 0.3);
  }, [floor, nextFloor]);
  return (
    <group>
      {rails.map((rail, index) => (
        <GuardRail key={index} start={rail.start} end={rail.end} top={top} lot={lot} materials={materials} />
      ))}
    </group>
  );
};
