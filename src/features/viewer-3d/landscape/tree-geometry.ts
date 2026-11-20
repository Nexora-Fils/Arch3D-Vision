import { CylinderGeometry, IcosahedronGeometry, Matrix4, Quaternion, Vector3, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type TreeSpecies = "broadleaf" | "birch" | "conifer";

export interface TreePlacement {
  x: number;
  z: number;
  scale: number;
  species: TreeSpecies;
}

interface Limb {
  start: Vector3;
  end: Vector3;
  bottomRadius: number;
  topRadius: number;
}

interface Lobe {
  center: Vector3;
  radii: Vector3;
}

/** Trunk, branches and crown lobes of one tree (scene coordinates). */
export const growTree = (tree: TreePlacement, random: () => number): { limbs: Limb[]; lobes: Lobe[] } => {
  const base = new Vector3(tree.x, 0, tree.z);
  const s = tree.scale;
  const limbs: Limb[] = [];
  const lobes: Lobe[] = [];
  if (tree.species === "conifer") {
    const height = 7.5 * s;
    limbs.push({ start: base, end: base.clone().setY(height * 0.92), bottomRadius: 0.2 * s, topRadius: 0.04 * s });
    const tiers = 6;
    for (let tier = 0; tier < tiers; tier += 1) {
      const t = tier / tiers;
      const radius = (1.9 - t * 1.55) * s;
      lobes.push({ center: base.clone().setY((1.4 + t * 5.4) * s), radii: new Vector3(radius, 0.75 * s, radius) });
    }
    return { limbs, lobes };
  }
  const isBirch = tree.species === "birch";
  if (isBirch) {
    // Birch: a slender trunk carrying many small, airy clumps spread up its whole height (no single ball).
    const height = 6.2 * s;
    limbs.push({ start: base, end: base.clone().setY(height), bottomRadius: 0.12 * s, topRadius: 0.035 * s });
    const clumps = 9;
    for (let index = 0; index < clumps; index += 1) {
      const t = 0.38 + (index / (clumps - 1)) * 0.6;
      const heading = index * 2.4 + random() * 0.8;
      const reach = (1 - t) * 1.6 * s + 0.3 * s;
      const start = base.clone().setY(height * t);
      const end = start
        .clone()
        .add(new Vector3(Math.cos(heading) * reach, 0.25 * s + random() * 0.35 * s, Math.sin(heading) * reach));
      limbs.push({ start, end, bottomRadius: 0.035 * s, topRadius: 0.012 * s });
      const radius = (0.45 + random() * 0.35) * s * (1.1 - t * 0.4);
      lobes.push({
        center: end.clone().add(new Vector3(0, -radius * 0.2, 0)),
        radii: new Vector3(radius * 1.15, radius * 0.9, radius * 1.15),
      });
    }
    return { limbs, lobes };
  }
  const trunkHeight = 2 * s;
  const top = base.clone().setY(trunkHeight);
  limbs.push({
    start: base,
    end: top,
    bottomRadius: (isBirch ? 0.12 : 0.19) * s,
    topRadius: (isBirch ? 0.07 : 0.11) * s,
  });
  const branches = isBirch ? 4 : 5 + Math.floor(random() * 3);
  for (let index = 0; index < branches; index += 1) {
    const heading = (index / branches) * Math.PI * 2 + random() * 0.9;
    const elevation = (isBirch ? 1.1 : 0.55) + random() * 0.5;
    const length = (isBirch ? 1.2 + random() * 0.9 : 1.3 + random() * 1.1) * s;
    const direction = new Vector3(
      Math.cos(heading) * Math.cos(elevation),
      Math.sin(elevation),
      Math.sin(heading) * Math.cos(elevation),
    );
    const start = top.clone().addScaledVector(new Vector3(0, -1, 0), random() * (isBirch ? 1.2 : 0.5) * s);
    const end = start.clone().addScaledVector(direction, length);
    limbs.push({ start, end, bottomRadius: (isBirch ? 0.05 : 0.09) * s, topRadius: 0.025 * s });
    // Irregular crown: lobes of varied size and squash at the branch tips.
    const radius = (isBirch ? 0.55 + random() * 0.4 : 0.75 + random() * 0.6) * s;
    lobes.push({
      center: end
        .clone()
        .add(new Vector3((random() - 0.5) * 0.4 * s, radius * (0.1 + random() * 0.4), (random() - 0.5) * 0.4 * s)),
      radii: new Vector3(
        radius * (0.85 + random() * 0.3),
        radius * (isBirch ? 1.4 : 0.7 + random() * 0.35),
        radius * (0.85 + random() * 0.3),
      ),
    });
  }
  const crown = (isBirch ? 0.85 : 1.25 + random() * 0.3) * s;
  lobes.push({
    center: top
      .clone()
      .add(new Vector3((random() - 0.5) * 0.5 * s, crown * (isBirch ? 1.9 : 1.15), (random() - 0.5) * 0.5 * s)),
    radii: new Vector3(crown, crown * (isBirch ? 1.7 : 0.85), crown * (0.9 + random() * 0.2)),
  });
  return { limbs, lobes };
};

/** Tapered cylinders merged into one geometry, UVs in meters so the bark keeps its scale. */
export const mergeLimbs = (limbs: Limb[]): BufferGeometry | null => {
  if (limbs.length === 0) return null;
  const up = new Vector3(0, 1, 0);
  const pieces = limbs.map((limb) => {
    const axis = new Vector3().subVectors(limb.end, limb.start);
    const length = axis.length();
    const cylinder = new CylinderGeometry(limb.topRadius, limb.bottomRadius, length, 10, 1, true);
    const uv = cylinder.getAttribute("uv");
    const circumference = Math.PI * (limb.topRadius + limb.bottomRadius);
    for (let index = 0; index < uv.count; index += 1)
      uv.setXY(index, uv.getX(index) * circumference, uv.getY(index) * length);
    const matrix = new Matrix4().compose(
      limb.start.clone().addScaledVector(axis, 0.5),
      new Quaternion().setFromUnitVectors(up, axis.normalize()),
      new Vector3(1, 1, 1),
    );
    cylinder.applyMatrix4(matrix);
    return cylinder;
  });
  const merged = mergeGeometries(pieces);
  pieces.forEach((piece) => piece.dispose());
  return merged;
};

/** Dark inner volumes of the crowns, so the sky does not shine through the leaves. */
export const mergeCores = (lobes: Lobe[]): BufferGeometry | null => {
  if (lobes.length === 0) return null;
  const pieces = lobes.map((lobe) => {
    const blob = new IcosahedronGeometry(1, 1);
    blob.scale(lobe.radii.x * 0.62, lobe.radii.y * 0.62, lobe.radii.z * 0.62);
    blob.translate(lobe.center.x, lobe.center.y, lobe.center.z);
    return blob;
  });
  const merged = mergeGeometries(pieces);
  pieces.forEach((piece) => piece.dispose());
  return merged;
};
