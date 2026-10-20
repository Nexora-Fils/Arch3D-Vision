"use client";

import { Arrow, Line, Rect } from "react-konva";
import { buildStairShape, type LocalVec, type StairPiece, type StairType } from "@/domain/plan/stairs";
import type { Furniture } from "@/domain/plan/schema";

/** Item frame (a to the right, c up the first flight) to the Konva group frame (y grows downward). */
const toKonva = (point: LocalVec): [number, number] => [point.a, -point.c];

const pieceStart = (piece: StairPiece): LocalVec => {
  const center = { a: (piece.rect.minA + piece.rect.maxA) / 2, c: (piece.rect.minC + piece.rect.maxC) / 2 };
  return { a: center.a - (piece.axis.a * piece.length) / 2, c: center.c - (piece.axis.c * piece.length) / 2 };
};

/** Point of a piece's centerline at `distance` from its entry edge. */
const alongPiece = (piece: StairPiece, distance: number): LocalVec => {
  const start = pieceStart(piece);
  return { a: start.a + piece.axis.a * distance, c: start.c + piece.axis.c * distance };
};

/**
 * Plan symbol of a stair of any model, drawn in the item's own frame: the
 * flights with one line per tread, the landing, and an arrow following the
 * walking line from the foot to the arrival.
 */
export const StairSymbol = ({ item, hasIssue }: { item: Pick<Furniture, "type" | "width" | "depth" | "height" | "x" | "y" | "rotation" | "id" | "color"> & { type: StairType }; hasIssue: boolean }) => {
  // Only the layout matters here: the rise sets the step count, as in 3D.
  const shape = buildStairShape({ ...item, x: 0, y: 0, rotation: 0 }, 2.95);
  const color = hasIssue ? "#dc2626" : "#334155";
  const walkingLine: number[] = [];
  shape.pieces.forEach((piece, index) => {
    if (piece.kind === "landing") {
      // Through the landing: from the previous flight's centerline to the next one's, at mid-landing.
      const previous = shape.pieces[index - 1];
      const next = shape.pieces[index + 1];
      const middle = { a: (piece.rect.minA + piece.rect.maxA) / 2, c: (piece.rect.minC + piece.rect.maxC) / 2 };
      for (const flight of [previous, next]) {
        const start = pieceStart(flight);
        const distance = (middle.a - start.a) * flight.axis.a + (middle.c - start.c) * flight.axis.c;
        walkingLine.push(...toKonva(alongPiece(flight, distance)));
      }
      return;
    }
    if (index === 0) walkingLine.push(...toKonva(alongPiece(piece, 0.15)));
    if (index === shape.pieces.length - 1) walkingLine.push(...toKonva(alongPiece(piece, piece.length - 0.2)));
  });
  return (
    <>
      {shape.pieces.map((piece, index) => {
        const [x, y] = toKonva({ a: piece.rect.minA, c: piece.rect.maxC });
        return (
          <Rect key={`piece-${index}`} x={x} y={y} width={piece.rect.maxA - piece.rect.minA} height={piece.rect.maxC - piece.rect.minC} fill={piece.kind === "landing" ? "#eef2f6" : "#f8fafc"} stroke={color} strokeWidth={1} strokeScaleEnabled={false} opacity={0.95} listening={false} />
        );
      })}
      {shape.pieces.flatMap((piece, index) => {
        if (piece.kind !== "flight") return [];
        const tread = piece.length / piece.steps;
        const across = { a: -piece.axis.c, c: piece.axis.a };
        return Array.from({ length: piece.steps - 1 }, (_, step) => {
          const middle = alongPiece(piece, tread * (step + 1));
          const from = { a: middle.a - (across.a * piece.width) / 2, c: middle.c - (across.c * piece.width) / 2 };
          const to = { a: middle.a + (across.a * piece.width) / 2, c: middle.c + (across.c * piece.width) / 2 };
          return <Line key={`tread-${index}-${step}`} points={[...toKonva(from), ...toKonva(to)]} stroke={color} strokeWidth={0.8} strokeScaleEnabled={false} opacity={0.55} listening={false} />;
        });
      })}
      <Arrow points={walkingLine} stroke={color} fill={color} strokeWidth={1.6} strokeScaleEnabled={false} pointerLength={0.22} pointerWidth={0.22} listening={false} />
    </>
  );
};
