import { ExtrudeGeometry, Path, Shape } from "three";
import type { WallSegment } from "@/domain/plan/geometry";

/**
 * Extrudes a wall segment: a rectangle (length × height) with one hole per
 * door or window, extruded by `depth` along Z and centered on the wall axis.
 * Local X runs along the segment, local Y is up, local Z is the wall normal.
 */
export const buildWallGeometry = (segment: WallSegment, depth: number): ExtrudeGeometry => {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(segment.length, 0);
  shape.lineTo(segment.length, segment.height);
  shape.lineTo(0, segment.height);
  shape.closePath();

  for (const opening of segment.openings) {
    const left = Math.max(0.01, opening.offset - opening.width / 2);
    const right = Math.min(segment.length - 0.01, opening.offset + opening.width / 2);
    const bottom = Math.max(0, opening.sillHeight);
    const top = Math.min(segment.height - 0.02, opening.sillHeight + opening.height);
    if (right - left < 0.05 || top - bottom < 0.05) continue;
    const hole = new Path();
    hole.moveTo(left, bottom);
    hole.lineTo(right, bottom);
    hole.lineTo(right, top);
    hole.lineTo(left, top);
    hole.closePath();
    shape.holes.push(hole);
  }

  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
};
