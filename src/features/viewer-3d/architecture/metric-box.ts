import { BoxGeometry } from "three";

/**
 * Box whose UVs are expressed in meters on every face, so photographic
 * materials (texture repeat = 1 / real size) keep their physical scale
 * without cloning a material per size.
 */
export const createMetricBox = (width: number, height: number, depth: number): BoxGeometry => {
  const geometry = new BoxGeometry(width, height, depth);
  const uv = geometry.getAttribute("uv");
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each).
  const faceSizes: [number, number][] = [
    [depth, height],
    [depth, height],
    [width, depth],
    [width, depth],
    [width, height],
    [width, height],
  ];
  faceSizes.forEach(([u, v], face) => {
    for (let vertex = face * 4; vertex < face * 4 + 4; vertex += 1) {
      uv.setXY(vertex, uv.getX(vertex) * u, uv.getY(vertex) * v);
    }
  });
  uv.needsUpdate = true;
  return geometry;
};
