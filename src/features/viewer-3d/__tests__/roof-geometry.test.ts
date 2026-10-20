import { Vector3, type BufferGeometry } from "three";
import { describe, expect, it } from "vitest";
import { buildPitchedRoof } from "../roof-geometry";

const vertices = (geometry: BufferGeometry): Vector3[] => {
  const position = geometry.getAttribute("position");
  return Array.from({ length: position.count }, (_, index) => new Vector3().fromBufferAttribute(position, index));
};

/** Face normals of a non-indexed geometry (one per triangle). */
const faceNormals = (geometry: BufferGeometry): Vector3[] => {
  const points = vertices(geometry);
  const normals: Vector3[] = [];
  for (let index = 0; index < points.length; index += 3) {
    const [a, b, c] = points.slice(index, index + 3);
    normals.push(new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a)).normalize());
  }
  return normals;
};

const spec = { width: 10, depth: 8, pitchDegrees: 45, overhang: 0.5, thickness: 0.2 };

describe("pitched roofs", () => {
  it("rest on the outer top edge of the walls, with the eaves below it and the ridge at half-span × tan(pitch)", () => {
    const roof = buildPitchedRoof({ ...spec, type: "gable" });
    expect(roof.ridgeHeight).toBeCloseTo(4);
    expect(roof.eaveHeight).toBeCloseTo(-0.5);
    // Underside at the wall face (z = 4) is at the wall top.
    const soffit = vertices(roof.soffit);
    const lowest = Math.min(...soffit.map((point) => point.y));
    expect(lowest).toBeCloseTo(-0.5);
    // Covering lies `thickness / cos(pitch)` above the underside.
    const covering = vertices(roof.covering);
    expect(Math.max(...covering.map((point) => point.y))).toBeCloseTo(4 + 0.2 / Math.cos(Math.PI / 4));
  });

  it("gable roofs have masonry gables, verges and two eaves; hip roofs have four eaves and four hips", () => {
    const gable = buildPitchedRoof({ ...spec, type: "gable" });
    expect(gable.gables.getAttribute("position").count).toBe(6);
    expect(gable.verges).toHaveLength(4);
    expect(gable.eaves).toHaveLength(2);
    expect(gable.hips).toHaveLength(0);
    const hip = buildPitchedRoof({ ...spec, type: "hip" });
    expect(hip.gables.getAttribute("position").count).toBe(0);
    expect(hip.eaves).toHaveLength(4);
    expect(hip.hips).toHaveLength(4);
    // Ridge shortened by the half-span at each end.
    const [ridge] = hip.ridges;
    expect(Math.abs(ridge.end[0] - ridge.start[0])).toBeCloseTo(2);
  });

  it("orients every covering face up and outward, and every gable outward", () => {
    for (const type of ["gable", "hip"] as const) {
      const roof = buildPitchedRoof({ ...spec, type });
      for (const normal of faceNormals(roof.covering)) expect(normal.y).toBeGreaterThan(0.1);
      for (const normal of faceNormals(roof.soffit)) expect(normal.y).toBeLessThan(-0.1);
    }
    const gables = vertices(buildPitchedRoof({ ...spec, type: "gable" }).gables);
    faceNormals(buildPitchedRoof({ ...spec, type: "gable" }).gables).forEach((normal, index) => {
      // Each triangle faces away from the center, along x.
      expect(Math.sign(normal.x)).toBe(Math.sign(gables[index * 3].x));
    });
  });

  it("maps textures in meters so tiles keep their real size", () => {
    const roof = buildPitchedRoof({ ...spec, type: "gable" });
    const uv = roof.covering.getAttribute("uv");
    const us = Array.from({ length: uv.count }, (_, index) => uv.getX(index));
    const vs = Array.from({ length: uv.count }, (_, index) => uv.getY(index));
    // Eaves are 10 + 2 × 0.5 = 11 m long; the slope is (4 + 0.5) / cos(45°) long.
    expect(Math.max(...us) - Math.min(...us)).toBeCloseTo(11);
    expect(Math.max(...vs) - Math.min(...vs)).toBeCloseTo(4.5 / Math.cos(Math.PI / 4));
  });

  it("turns the ridge along z when the footprint is deeper than wide", () => {
    const roof = buildPitchedRoof({ ...spec, width: 8, depth: 10, type: "gable" });
    expect(roof.ridgeAlongX).toBe(false);
    const [ridge] = roof.ridges;
    expect(ridge.start[0]).toBeCloseTo(0);
    expect(Math.abs(ridge.end[2] - ridge.start[2])).toBeCloseTo(11);
  });
});
