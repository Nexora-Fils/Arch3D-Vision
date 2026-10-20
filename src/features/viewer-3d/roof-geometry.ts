import { BufferGeometry, Float32BufferAttribute } from "three";
import type { RoofType } from "@/domain/plan/schema";

export type Point3 = [number, number, number];

export interface RoofSpec {
  type: Exclude<RoofType, "flat">;
  /** Outer faces of the walls under the roof (m), centered on the origin. */
  width: number;
  depth: number;
  pitchDegrees: number;
  /** Horizontal overhang of the eaves and of the gable verges beyond the wall faces (m). */
  overhang: number;
  /** Thickness of the covering (rafters + battens + tiles), measured perpendicular to the slope (m). */
  thickness: number;
}

export interface Segment3 {
  start: Point3;
  end: Point3;
}

/**
 * A pitched roof built like the real one, in a frame centered on the
 * footprint with y = 0 at the top of the walls: the slope's underside passes
 * through the outer top edge of the walls, so the eaves drop below it.
 */
export interface PitchedRoof {
  /** Upper surfaces (tiles, slates), UVs in meters: u along the eaves, v up the slope. */
  covering: BufferGeometry;
  /** Undersides visible past the walls (soffits), UVs in meters. */
  soffit: BufferGeometry;
  /** Masonry gable triangles in the wall planes, under the roof (gable roofs only), UVs in meters. */
  gables: BufferGeometry;
  ridges: Segment3[];
  hips: Segment3[];
  /** Eave lines, at the outer edge of the underside. */
  eaves: Segment3[];
  /** Sloped gable edges (gable roofs only). */
  verges: Segment3[];
  /** Height of the underside at the ridge, above the wall tops (m). */
  ridgeHeight: number;
  /** Height of the eave underside (negative: below the wall tops). */
  eaveHeight: number;
  /** True when the ridge runs along x. */
  ridgeAlongX: boolean;
}

interface Face {
  /** Corner points, counter-clockwise seen from the side the face is visible from. */
  points: Point3[];
  /** Unit vector of the u axis (meters) and origin of the planar mapping. */
  uAxis: Point3;
  vAxis: Point3;
  origin: Point3;
}

const sub = (a: Point3, b: Point3): Point3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Point3, b: Point3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (a: Point3): Point3 => {
  const length = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / length, a[1] / length, a[2] / length];
};

/** Triangulated faces (fan per polygon) with planar UVs in meters. */
const facesToGeometry = (faces: Face[]): BufferGeometry => {
  const positions: number[] = [];
  const uvs: number[] = [];
  for (const face of faces) {
    for (let index = 1; index < face.points.length - 1; index += 1) {
      for (const point of [face.points[0], face.points[index], face.points[index + 1]]) {
        positions.push(...point);
        const local = sub(point, face.origin);
        uvs.push(dot(local, face.uAxis), dot(local, face.vAxis));
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
};

/** Reverses the winding so the face is seen from the other side. */
const flip = (face: Face): Face => ({ ...face, points: [...face.points].reverse() });

const swapAxes = (point: Point3): Point3 => [point[2], point[1], -point[0]];

/**
 * Builds a gable or hip roof over a rectangular footprint. The ridge follows
 * the longer side; hips run at 45° in plan from the eave corners.
 */
export const buildPitchedRoof = ({ type, width, depth, pitchDegrees, overhang, thickness }: RoofSpec): PitchedRoof => {
  const ridgeAlongX = width >= depth;
  // Local frame: ridge along x, half-length a, half-span b (wall faces).
  const a = Math.max(width, depth) / 2;
  const b = Math.min(width, depth) / 2;
  const tan = Math.tan((pitchDegrees * Math.PI) / 180);
  const cos = Math.cos((pitchDegrees * Math.PI) / 180);
  const lift = thickness / cos;
  const ridgeHeight = b * tan;
  const eaveHeight = -overhang * tan;
  const eaveZ = b + overhang;
  const eaveX = a + overhang;
  const ridgeHalf = type === "gable" ? eaveX : Math.max(0, a - b);

  // Underside height of the slope facing +z (or -z) at plan distance z from the ridge.
  const under = (z: number) => (b - Math.abs(z)) * tan;
  // Same for the end slopes of a hip roof (facing ±x).
  const underEnd = (x: number) => (a - Math.abs(x)) * tan;

  const slopeAxisZ: Point3 = normalize([0, -tan, 1]);
  const slopeAxisX: Point3 = normalize([1, -tan, 0]);
  const top: Face[] = [];
  const bottom: Face[] = [];
  const addSlope = (points: Point3[], uAxis: Point3, vAxis: Point3) => {
    const origin = points[0];
    bottom.push(flip({ points, uAxis, vAxis, origin }));
    top.push({ points: points.map(([x, y, z]) => [x, y + lift, z] as Point3), uAxis, vAxis, origin: [origin[0], origin[1] + lift, origin[2]] });
  };

  for (const side of [1, -1] as const) {
    // Long slopes: trapezoid (hip) or rectangle (gable), counter-clockwise from above.
    const eaveLeft: Point3 = [-eaveX, under(eaveZ), side * eaveZ];
    const eaveRight: Point3 = [eaveX, under(eaveZ), side * eaveZ];
    const ridgeLeft: Point3 = [-ridgeHalf, ridgeHeight, 0];
    const ridgeRight: Point3 = [ridgeHalf, ridgeHeight, 0];
    const points = side === 1 ? [eaveLeft, eaveRight, ridgeRight, ridgeLeft] : [eaveRight, eaveLeft, ridgeLeft, ridgeRight];
    // v climbs the slope: opposite of the downhill axis.
    const downhill: Point3 = [0, slopeAxisZ[1], side * slopeAxisZ[2]];
    addSlope(points, [side, 0, 0], [-downhill[0], -downhill[1], -downhill[2]]);
  }

  const hips: Segment3[] = [];
  const verges: Segment3[] = [];
  const eaves: Segment3[] = [];
  const gableFaces: Face[] = [];
  for (const side of [1, -1] as const) {
    eaves.push({ start: [-eaveX, eaveHeight, side * eaveZ], end: [eaveX, eaveHeight, side * eaveZ] });
  }
  if (type === "hip") {
    for (const end of [1, -1] as const) {
      const apex: Point3 = [end * ridgeHalf, ridgeHeight, 0];
      const near: Point3 = [end * eaveX, underEnd(eaveX), -eaveZ];
      const far: Point3 = [end * eaveX, underEnd(eaveX), eaveZ];
      const points = end === 1 ? [near, apex, far] : [far, apex, near];
      const downhill: Point3 = [end * slopeAxisX[0], slopeAxisX[1], 0];
      addSlope(points, [0, 0, -end], [-downhill[0], -downhill[1], -downhill[2]]);
      eaves.push({ start: [end * eaveX, eaveHeight, -eaveZ], end: [end * eaveX, eaveHeight, eaveZ] });
      for (const side of [1, -1] as const) hips.push({ start: [end * eaveX, eaveHeight + lift, side * eaveZ], end: [apex[0], apex[1] + lift, 0] });
    }
  } else {
    for (const end of [1, -1] as const) {
      for (const side of [1, -1] as const) verges.push({ start: [end * eaveX, eaveHeight + lift, side * eaveZ], end: [end * eaveX, ridgeHeight + lift, 0] });
      // Gable wall triangle in the wall plane, facing outward (±x).
      const low: Point3 = [end * a, 0, -end * b];
      const high: Point3 = [end * a, 0, end * b];
      const apex: Point3 = [end * a, ridgeHeight, 0];
      gableFaces.push({ points: [high, low, apex], uAxis: [0, 0, -end], vAxis: [0, 1, 0], origin: low });
    }
  }

  const ridges: Segment3[] = ridgeHalf > 1e-3 ? [{ start: [-ridgeHalf, ridgeHeight + lift, 0], end: [ridgeHalf, ridgeHeight + lift, 0] }] : [];

  const covering = facesToGeometry(top);
  const soffit = facesToGeometry(bottom);
  const gables = facesToGeometry(gableFaces);
  const orient = (segment: Segment3): Segment3 => (ridgeAlongX ? segment : { start: swapAxes(segment.start), end: swapAxes(segment.end) });
  if (!ridgeAlongX) {
    for (const geometry of [covering, soffit, gables]) geometry.rotateY(Math.PI / 2);
  }
  return {
    covering,
    soffit,
    gables,
    ridges: ridges.map(orient),
    hips: hips.map(orient),
    eaves: eaves.map(orient),
    verges: verges.map(orient),
    ridgeHeight,
    eaveHeight,
    ridgeAlongX,
  };
};
