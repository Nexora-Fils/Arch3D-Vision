"use client";

import { useMemo } from "react";
import { Vector3 } from "three";
import type { Lot } from "@/domain/plan/schema";
import { useMergedBoxes, type BoxPart } from "@/features/viewer-3d/architecture/merged-boxes";
import { toScene } from "@/features/viewer-3d/convert";
import { createRandom, hedgeCards, packCards } from "@/features/viewer-3d/landscape/foliage";
import { FoliageCards, useFoliageMaterials } from "@/features/viewer-3d/landscape/foliage-cards";
import type { PathRect } from "@/features/viewer-3d/landscape/paths";

interface HedgeRun {
  x: number;
  y: number;
  width: number;
  depth: number;
}

const HEDGE_HEIGHT = 1.1;
const HEDGE_THICKNESS = 0.7;

/** Hedge runs along the lot edges, interrupted where paths reach the street. */
const hedgeRuns = (lot: Lot, paths: PathRect[]): HedgeRun[] => {
  const inset = 0.55;
  const gap = 0.5;
  const thickness = HEDGE_THICKNESS;
  const items: HedgeRun[] = [];
  const sides: { axis: "x" | "y"; at: number; from: number; to: number }[] = [
    { axis: "x", at: inset, from: inset, to: lot.width - inset },
    { axis: "x", at: lot.depth - inset, from: inset, to: lot.width - inset },
    { axis: "y", at: inset, from: inset + thickness, to: lot.depth - inset - thickness },
    { axis: "y", at: lot.width - inset, from: inset + thickness, to: lot.depth - inset - thickness },
  ];
  for (const side of sides) {
    const cuts = paths
      .filter((path) =>
        side.axis === "x"
          ? path.bounds.minY <= side.at + thickness && path.bounds.maxY >= side.at - thickness
          : path.bounds.minX <= side.at + thickness && path.bounds.maxX >= side.at - thickness,
      )
      .map((path) =>
        side.axis === "x"
          ? [path.bounds.minX - gap, path.bounds.maxX + gap]
          : [path.bounds.minY - gap, path.bounds.maxY + gap],
      )
      .sort((a, b) => a[0] - b[0]);
    let cursor = side.from;
    const push = (from: number, to: number) => {
      if (to - from < 0.5) return;
      if (side.axis === "x") items.push({ x: (from + to) / 2, y: side.at, width: to - from, depth: thickness });
      else items.push({ x: side.at, y: (from + to) / 2, width: thickness, depth: to - from });
    };
    for (const [cutFrom, cutTo] of cuts) {
      push(cursor, Math.min(cutFrom, side.to));
      cursor = Math.max(cursor, cutTo);
    }
    push(cursor, side.to);
  }
  return items;
};

interface HedgesProps {
  lot: Lot;
  paths: PathRect[];
  quality: "low" | "high";
}

/** Clipped hedges: a dark core covered with thousands of leaf cards. */
export const Hedges = ({ lot, paths, quality }: HedgesProps) => {
  const foliage = useFoliageMaterials();
  const runs = useMemo(() => hedgeRuns(lot, paths), [lot, paths]);
  const cards = useMemo(() => {
    const random = createRandom(lot.width * 131 + lot.depth * 17);
    const density = quality === "high" ? 95 : 45;
    const all = runs.flatMap((run) => {
      const [x, z] = toScene({ x: run.x, y: run.y }, lot);
      return hedgeCards(
        new Vector3(x, HEDGE_HEIGHT / 2, z),
        new Vector3(run.width / 2, HEDGE_HEIGHT / 2, run.depth / 2),
        density,
        [0.26, 0.42],
        random,
      );
    });
    return packCards(all, random);
  }, [runs, lot, quality]);
  const coreParts = useMemo<BoxPart[]>(
    () =>
      runs.map((run) => {
        const [x, z] = toScene({ x: run.x, y: run.y }, lot);
        return {
          size: [Math.max(0.1, run.width - 0.16), HEDGE_HEIGHT - 0.12, Math.max(0.1, run.depth - 0.16)],
          position: [x, (HEDGE_HEIGHT - 0.12) / 2, z],
        };
      }),
    [runs, lot],
  );
  const core = useMergedBoxes(coreParts);
  return (
    <group>
      {core ? <mesh geometry={core} material={foliage.core} castShadow receiveShadow /> : null}
      <FoliageCards set={cards} material={foliage.hedge} />
    </group>
  );
};
