"use client";

import { useMemo } from "react";
import type { Bounds } from "@/domain/plan/geometry";
import type { Lot } from "@/domain/plan/schema";
import { toScene } from "@/features/viewer-3d/convert";
import { createRandom } from "@/features/viewer-3d/landscape/foliage";
import { boundsOverlap, type PathRect } from "@/features/viewer-3d/landscape/paths";
import { ScannedModel } from "@/features/viewer-3d/scanned-model";

interface FlowerBedsProps {
  lot: Lot;
  houseBounds: Bounds;
  paths: PathRect[];
}

/** Scanned flowering plants, bushes and grasses scattered along the hedges, away from paths and the house. */
export const FlowerBeds = ({ lot, houseBounds, paths }: FlowerBedsProps) => {
  const flowers = useMemo(() => {
    const random = createRandom(lot.width * 53 + lot.depth * 97);
    const items: { x: number; y: number; r: number; tone: number }[] = [];
    const candidates = 60;
    for (let index = 0; index < candidates; index += 1) {
      const alongEdge = random();
      const side = Math.floor(random() * 4);
      const offset = 1.3 + random() * 0.6;
      const x =
        side === 0
          ? alongEdge * lot.width
          : side === 1
            ? lot.width - offset
            : side === 2
              ? alongEdge * lot.width
              : offset;
      const y =
        side === 0
          ? offset
          : side === 1
            ? alongEdge * lot.depth
            : side === 2
              ? lot.depth - offset
              : alongEdge * lot.depth;
      if (x < 1 || x > lot.width - 1 || y < 1 || y > lot.depth - 1) continue;
      const nearHouse =
        x > houseBounds.minX - 1.2 &&
        x < houseBounds.maxX + 1.2 &&
        y > houseBounds.minY - 1.2 &&
        y < houseBounds.maxY + 1.2;
      const onPath = paths.some((path) =>
        boundsOverlap(path.bounds, { minX: x - 0.5, maxX: x + 0.5, minY: y - 0.5, maxY: y + 0.5 }),
      );
      if (nearHouse || onPath) continue;
      items.push({ x, y, r: 0.22 + random() * 0.2, tone: Math.floor(random() * 3) });
    }
    return items;
  }, [houseBounds, lot.depth, lot.width, paths]);
  const models = ["flowers", "bushes", "flowers", "tallGrass"] as const;
  return (
    <group>
      {flowers.map((flower, index) => {
        const [x, z] = toScene({ x: flower.x, y: flower.y }, lot);
        const model = models[(flower.tone + index) % models.length];
        const length = 1.4 + flower.r;
        const height = model === "tallGrass" ? 0.45 : model === "flowers" ? 0.4 + flower.r : 0.35 + flower.r;
        return (
          <group key={index} position={[x, 0, z]} rotation-y={flower.x * 3.1 + flower.y * 1.3}>
            <ScannedModel model={model} width={length} depth={length * 0.4} height={height} />
          </group>
        );
      })}
    </group>
  );
};
