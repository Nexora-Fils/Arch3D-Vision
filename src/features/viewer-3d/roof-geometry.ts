import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from "three";
import type { RoofType } from "@/domain/plan/schema";

export interface RoofSpec {
  /** Footprint already including the overhang. */
  width: number;
  depth: number;
  pitchDegrees: number;
  type: RoofType;
}

type Point3 = [number, number, number];

const pushTriangle = (target: number[], a: Point3, b: Point3, c: Point3) => {
  target.push(...a, ...b, ...c);
};

const pushQuad = (target: number[], a: Point3, b: Point3, c: Point3, d: Point3) => {
  pushTriangle(target, a, b, c);
  pushTriangle(target, a, c, d);
};

/**
 * Roof centered on the origin with the eaves at y = 0. Gable and hip roofs
 * share one topology: two slopes plus two end faces; the gable simply has a
 * ridge as long as the building, which turns the end faces into vertical
 * triangles.
 */
export const buildRoofGeometry = ({ width, depth, pitchDegrees, type }: RoofSpec): BufferGeometry => {
  if (type === "flat") {
    const slab = new BoxGeometry(width, 0.25, depth);
    slab.translate(0, 0.125, 0);
    return slab;
  }

  const ridgeAlongX = width >= depth;
  const long = Math.max(width, depth);
  const short = Math.min(width, depth);
  const height = (short / 2) * Math.tan((pitchDegrees * Math.PI) / 180);
  const halfLong = long / 2;
  const halfShort = short / 2;
  const ridgeHalf = type === "gable" ? halfLong : Math.max(0, halfLong - halfShort);

  const frontLeft: Point3 = [-halfLong, 0, halfShort];
  const frontRight: Point3 = [halfLong, 0, halfShort];
  const backLeft: Point3 = [-halfLong, 0, -halfShort];
  const backRight: Point3 = [halfLong, 0, -halfShort];
  const ridgeLeft: Point3 = [-ridgeHalf, height, 0];
  const ridgeRight: Point3 = [ridgeHalf, height, 0];

  const positions: number[] = [];
  pushQuad(positions, frontLeft, frontRight, ridgeRight, ridgeLeft);
  pushQuad(positions, backRight, backLeft, ridgeLeft, ridgeRight);
  pushTriangle(positions, backLeft, frontLeft, ridgeLeft);
  pushTriangle(positions, frontRight, backRight, ridgeRight);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  if (!ridgeAlongX) geometry.rotateY(Math.PI / 2);
  return geometry;
};
