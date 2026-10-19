"use client";

import { Arrow, Group, Line, Text } from "react-konva";
import type { StairFlight } from "@/domain/plan/stairs";
import { LABEL_FONT } from "@/features/editor-2d/canvas-utils";

const COLOR = "#2563eb";

/**
 * Upper-floor view of a flight coming from the level below: the stairwell
 * (dashed, crossed) and an arrow showing where the visitor arrives.
 */
export const StairwellOutline = ({ flight }: { flight: StairFlight }) => {
  const [bottomLeft, bottomRight, topRight, topLeft] = flight.corners;
  const outline = [bottomLeft, bottomRight, topRight, topLeft, bottomLeft].flatMap((point) => [point.x, point.y]);
  const top = { x: flight.bottom.x + flight.direction.x * flight.run, y: flight.bottom.y + flight.direction.y * flight.run };
  const arrival = { x: top.x + flight.direction.x * 0.7, y: top.y + flight.direction.y * 0.7 };
  // Near the foot of the opening, clear of the room label drawn at the room center.
  const labelAt = { x: flight.bottom.x + flight.direction.x * 0.4, y: flight.bottom.y + flight.direction.y * 0.4 };
  return (
    <Group listening={false}>
      <Line points={outline} closed fill="rgba(37, 99, 235, 0.06)" stroke={COLOR} strokeWidth={1.4} dash={[0.15, 0.1]} strokeScaleEnabled={false} />
      <Line points={[bottomLeft.x, bottomLeft.y, topRight.x, topRight.y]} stroke={COLOR} strokeWidth={0.8} strokeScaleEnabled={false} opacity={0.5} />
      <Line points={[bottomRight.x, bottomRight.y, topLeft.x, topLeft.y]} stroke={COLOR} strokeWidth={0.8} strokeScaleEnabled={false} opacity={0.5} />
      <Arrow points={[top.x - flight.direction.x * 0.5, top.y - flight.direction.y * 0.5, arrival.x, arrival.y]} stroke={COLOR} fill={COLOR} strokeWidth={1.6} strokeScaleEnabled={false} pointerLength={0.2} pointerWidth={0.2} />
      <Text
        x={labelAt.x}
        y={labelAt.y}
        offsetX={0.55}
        offsetY={0.12}
        width={1.1}
        align="center"
        text="Trémie"
        fontSize={0.22}
        fontFamily={LABEL_FONT}
        fill={COLOR}
        fontStyle="600"
      />
    </Group>
  );
};
