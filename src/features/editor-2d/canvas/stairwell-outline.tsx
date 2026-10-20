"use client";

import { Arrow, Group, Line, Text } from "react-konva";
import { vecAdd, vecScale } from "@/domain/plan/geometry";
import type { StairFlight } from "@/domain/plan/stairs";
import { LABEL_FONT } from "@/features/editor-2d/canvas-utils";

const COLOR = "#2563eb";

/**
 * Upper-floor view of a stair coming from the level below: the stairwell
 * (every flight, landing and well dashed and crossed) and an arrow showing
 * where the visitor arrives.
 */
export const StairwellOutline = ({ flight }: { flight: StairFlight }) => {
  const arrowFrom = vecAdd(flight.exit.center, vecScale(flight.exit.direction, -0.5));
  const arrowTo = vecAdd(flight.exit.center, vecScale(flight.exit.direction, 0.7));
  const first = flight.pieces[0];
  // Over the first flight, clear of the room label drawn at the room center.
  const labelAt = vecAdd(first.start, vecScale(first.direction, Math.min(0.6, first.length / 2)));
  return (
    <Group listening={false}>
      {flight.openings.map((bounds, index) => (
        <Group key={index}>
          <Line
            points={[bounds.minX, bounds.minY, bounds.maxX, bounds.minY, bounds.maxX, bounds.maxY, bounds.minX, bounds.maxY]}
            closed
            fill="rgba(37, 99, 235, 0.06)"
            stroke={COLOR}
            strokeWidth={1.4}
            dash={[0.15, 0.1]}
            strokeScaleEnabled={false}
          />
          <Line points={[bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]} stroke={COLOR} strokeWidth={0.8} strokeScaleEnabled={false} opacity={0.5} />
          <Line points={[bounds.maxX, bounds.minY, bounds.minX, bounds.maxY]} stroke={COLOR} strokeWidth={0.8} strokeScaleEnabled={false} opacity={0.5} />
        </Group>
      ))}
      <Arrow points={[arrowFrom.x, arrowFrom.y, arrowTo.x, arrowTo.y]} stroke={COLOR} fill={COLOR} strokeWidth={1.6} strokeScaleEnabled={false} pointerLength={0.2} pointerWidth={0.2} />
      <Text x={labelAt.x} y={labelAt.y} offsetX={0.55} offsetY={0.12} width={1.1} align="center" text="Trémie" fontSize={0.22} fontFamily={LABEL_FONT} fill={COLOR} fontStyle="600" />
    </Group>
  );
};
