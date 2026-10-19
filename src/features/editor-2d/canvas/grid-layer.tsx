"use client";

import type { Context } from "konva/lib/Context";
import { Rect, Shape, Text } from "react-konva";
import { patternScaleFor } from "@/features/editor-2d/use-plan-images";
import type { Lot, Vec2 } from "@/domain/plan/schema";

interface GridLayerProps {
  lot: Lot;
  scale: number;
  showGrid: boolean;
  viewport: { pan: Vec2; size: { width: number; height: number } };
  grassImage: HTMLImageElement | null;
}

const drawGrid = (
  context: Context,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  step: number,
  color: string,
  lineWidth: number,
) => {
  context.beginPath();
  for (let x = Math.ceil(bounds.minX / step) * step; x <= bounds.maxX; x += step) {
    context.moveTo(x, bounds.minY);
    context.lineTo(x, bounds.maxY);
  }
  for (let y = Math.ceil(bounds.minY / step) * step; y <= bounds.maxY; y += step) {
    context.moveTo(bounds.minX, y);
    context.lineTo(bounds.maxX, y);
  }
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.stroke();
};

/** Dark workspace with a faint grid, and the lot drawn as a light sheet with its own metric grid. */
export const GridLayer = ({ lot, scale, showGrid, viewport, grassImage }: GridLayerProps) => {
  const minX = Math.floor(-viewport.pan.x / scale) - 1;
  const minY = Math.floor(-viewport.pan.y / scale) - 1;
  const maxX = Math.ceil((viewport.size.width - viewport.pan.x) / scale) + 1;
  const maxY = Math.ceil((viewport.size.height - viewport.pan.y) / scale) + 1;
  const minorStep = scale >= 40 ? 0.5 : scale >= 15 ? 1 : 5;
  const majorStep = minorStep * (minorStep === 0.5 ? 2 : minorStep === 1 ? 5 : 2);
  const pixel = 1 / scale;

  const viewportBounds = { minX, minY, maxX, maxY };
  const lotBounds = { minX: 0, minY: 0, maxX: lot.width, maxY: lot.depth };
  return (
    <>
      <Rect name="background" x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="#e9edf2" />
      {showGrid ? (
        <Shape
          listening={false}
          sceneFunc={(context) => {
            drawGrid(context, viewportBounds, minorStep, "rgba(15, 23, 42, 0.05)", pixel);
            drawGrid(context, viewportBounds, majorStep, "rgba(15, 23, 42, 0.12)", pixel);
          }}
        />
      ) : null}
      <Rect
        name="background"
        x={0}
        y={0}
        width={lot.width}
        height={lot.depth}
        fill={grassImage ? undefined : "#e7efdc"}
        fillPatternImage={grassImage ?? undefined}
        fillPatternScale={grassImage ? patternScaleFor("grass") : undefined}
        stroke="#7c9a62"
        strokeWidth={2 * pixel}
        shadowColor="#0f172a"
        shadowBlur={18 * pixel}
        shadowOpacity={0.25}
      />
      {grassImage ? <Rect x={0} y={0} width={lot.width} height={lot.depth} fill="#4f8a32" opacity={0.28} listening={false} /> : null}
      {showGrid ? (
        <Shape
          listening={false}
          sceneFunc={(context) => {
            drawGrid(context, lotBounds, minorStep, "rgba(255, 255, 255, 0.10)", pixel);
            drawGrid(context, lotBounds, majorStep, "rgba(255, 255, 255, 0.22)", pixel);
          }}
        />
      ) : null}
      <Text x={0.15} y={-0.5} text={`Terrain ${lot.width} × ${lot.depth} m`} fontSize={0.3} fontFamily="system-ui, sans-serif" fill="#475569" listening={false} />
    </>
  );
};
