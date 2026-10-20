"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, CylinderGeometry, IcosahedronGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, PlaneGeometry, Quaternion, Vector3, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildWallSegments, vecAdd, vecScale, type Bounds } from "@/domain/plan/geometry";
import type { Floor, Lot } from "@/domain/plan/schema";
import { MetricBox } from "@/features/viewer-3d/architecture/parts";
import { useMergedBoxes, type BoxPart } from "@/features/viewer-3d/architecture/merged-boxes";
import { toScene } from "@/features/viewer-3d/convert";
import { cardAttributes, createFoliageMaterial, createLeafAtlas, createRandom, ellipsoidCards, hedgeCards, packCards, type CardSet } from "@/features/viewer-3d/landscape/foliage";
import { ScannedModel } from "@/features/viewer-3d/scanned-model";
import { useTiledMaterial, type SceneMaterials } from "@/features/viewer-3d/scene-materials";

/**
 * Landscaping generated around the house: lawn blended into the photographed
 * surroundings, paved paths with kerbs from every exterior door, clipped
 * hedges along the lot, trees with bark trunks and leafy crowns, shrubs and
 * flower beds. Leaves are instanced alpha-tested cards (one draw call per
 * species) lit with the normal of their crown or hedge.
 */

export interface PathRect {
  x: number;
  y: number;
  width: number;
  depth: number;
  /** Wide openings (garage doors) get a gravel driveway. */
  isDriveway: boolean;
  angle: number;
  /** Axis-aligned footprint, used to keep hedges away. */
  bounds: Bounds;
}

/** Paved paths from every exterior ground-floor door to the lot edge (driveway for the garage). */
export const computePaths = (floor: Floor, lot: Lot): PathRect[] => {
  const segments = buildWallSegments(floor);
  const items: PathRect[] = [];
  for (const segment of segments) {
    if (segment.exteriorSide === 0) continue;
    for (const opening of segment.openings) {
      if (opening.kind !== "door") continue;
      const outward = vecScale(segment.normal, segment.exteriorSide);
      const center = vecAdd(segment.start, vecScale(segment.direction, opening.offset));
      const edge = vecAdd(center, vecScale(outward, segment.thickness / 2));
      const limits: number[] = [];
      if (outward.x > 1e-6) limits.push((lot.width - edge.x) / outward.x);
      if (outward.x < -1e-6) limits.push(edge.x / -outward.x);
      if (outward.y > 1e-6) limits.push((lot.depth - edge.y) / outward.y);
      if (outward.y < -1e-6) limits.push(edge.y / -outward.y);
      const length = Math.min(...limits);
      if (!Number.isFinite(length) || length < 0.5) continue;
      const width = Math.max(1.2, opening.width + 0.4);
      const middle = vecAdd(edge, vecScale(outward, length / 2));
      const halfAlong = vecScale(outward, length / 2);
      const halfAcross = vecScale(segment.direction, width / 2);
      const corners = [
        vecAdd(vecAdd(middle, halfAlong), halfAcross),
        vecAdd(vecAdd(middle, halfAlong), vecScale(halfAcross, -1)),
        vecAdd(vecAdd(middle, vecScale(halfAlong, -1)), halfAcross),
        vecAdd(vecAdd(middle, vecScale(halfAlong, -1)), vecScale(halfAcross, -1)),
      ];
      items.push({
        x: middle.x,
        y: middle.y,
        width,
        depth: length,
        isDriveway: opening.width >= 2,
        angle: Math.atan2(outward.y, outward.x),
        bounds: {
          minX: Math.min(...corners.map((corner) => corner.x)),
          maxX: Math.max(...corners.map((corner) => corner.x)),
          minY: Math.min(...corners.map((corner) => corner.y)),
          maxY: Math.max(...corners.map((corner) => corner.y)),
        },
      });
    }
  }
  return items;
};

const boundsOverlap = (a: Bounds, b: Bounds, margin = 0): boolean =>
  a.minX < b.maxX + margin && a.maxX > b.minX - margin && a.minY < b.maxY + margin && a.maxY > b.minY - margin;


/** Lawn margin around the lot that fades into the photographed ground (m). */
const LAWN_FADE = 22;

/**
 * Lot lawn. In high quality the landscape beyond the lot is the HDR photograph
 * projected on the ground: the lawn extends past the lot and fades into it.
 * The low-quality profile (procedural sky) keeps a plain countryside plane.
 */
export const Ground = ({ lot, materials, quality }: { lot: Lot; materials: SceneMaterials; quality: "low" | "high" }) => {
  const isPhotographic = quality === "high";
  const size = 1200;
  const width = lot.width + (isPhotographic ? LAWN_FADE * 2 : 0);
  const depth = lot.depth + (isPhotographic ? LAWN_FADE * 2 : 0);
  const surroundings = useTiledMaterial(materials.surroundings, size, size);
  const tiled = useTiledMaterial(materials.ground, width, depth);
  const fade = useMemo(() => (isPhotographic ? createFadeTexture(lot.width / width, lot.depth / depth) : null), [isPhotographic, lot.width, lot.depth, width, depth]);
  const lawn = useMemo(() => {
    if (!fade) return tiled;
    const material = tiled.clone();
    material.alphaMap = fade;
    material.transparent = true;
    return material;
  }, [tiled, fade]);
  useEffect(
    () => () => {
      fade?.dispose();
      if (lawn !== tiled) lawn.dispose();
    },
    [fade, lawn, tiled],
  );
  return (
    <group>
      {isPhotographic ? null : (
        <mesh rotation-x={-Math.PI / 2} position-y={-0.03} receiveShadow material={surroundings}>
          <planeGeometry args={[size, size]} />
        </mesh>
      )}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} receiveShadow material={lawn} renderOrder={-0.5}>
        <planeGeometry args={[width, depth]} />
      </mesh>
    </group>
  );
};

/** Alpha map: opaque over the lot (inner fraction of the plane), smooth falloff to transparent at the edges. */
const createFadeTexture = (innerWidth: number, innerDepth: number): CanvasTexture => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const image = context.createImageData(size, size);
    const smooth = (t: number) => t * t * (3 - 2 * t);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        // Distance outside the lot, as a fraction of the margin (0 inside the lot, 1 at the plane edge).
        const u = Math.max(0, (Math.abs(x / (size - 1) - 0.5) * 2 - innerWidth) / (1 - innerWidth));
        const v = Math.max(0, (Math.abs(y / (size - 1) - 0.5) * 2 - innerDepth) / (1 - innerDepth));
        const value = Math.round(255 * (1 - smooth(Math.min(1, Math.hypot(u, v)))));
        const index = (y * size + x) * 4;
        image.data[index] = value;
        image.data[index + 1] = value;
        image.data[index + 2] = value;
        image.data[index + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }
  return new CanvasTexture(canvas);
};


/** Paved path (or gravel driveway) with concrete kerbs along both sides. */
export const PathSlab = ({ path, lot, material, materials }: { path: PathRect; lot: Lot; material: MeshStandardMaterial; materials: SceneMaterials }) => {
  const tiled = useTiledMaterial(material, path.depth, path.width);
  const [x, z] = toScene({ x: path.x, y: path.y }, lot);
  const kerb = 0.08;
  return (
    <group position={[x, 0, z]} rotation-y={-path.angle}>
      <mesh position-y={0.012} receiveShadow material={tiled}>
        <boxGeometry args={[path.depth, 0.03, path.width]} />
      </mesh>
      {[1, -1].map((side) => (
        // Nearly flush kerbs: their top (3.4 cm) stays under a pool's water level (3.5 cm) when a path runs past it.
        <MetricBox key={side} size={[path.depth, 0.05, kerb]} position={[0, 0.009, side * (path.width / 2 + kerb / 2)]} material={materials.kerb} castShadow />
      ))}
    </group>
  );
};

/** Scanned flowering plants, bushes and grasses scattered along the hedges, away from paths and the house. */
export const FlowerBeds = ({ lot, houseBounds, paths }: { lot: Lot; houseBounds: Bounds; paths: PathRect[] }) => {
  const flowers = useMemo(() => {
    const random = createRandom(lot.width * 53 + lot.depth * 97);
    const items: { x: number; y: number; r: number; tone: number }[] = [];
    const candidates = 60;
    for (let index = 0; index < candidates; index += 1) {
      const alongEdge = random();
      const side = Math.floor(random() * 4);
      const offset = 1.3 + random() * 0.6;
      const x = side === 0 ? alongEdge * lot.width : side === 1 ? lot.width - offset : side === 2 ? alongEdge * lot.width : offset;
      const y = side === 0 ? offset : side === 1 ? alongEdge * lot.depth : side === 2 ? lot.depth - offset : alongEdge * lot.depth;
      if (x < 1 || x > lot.width - 1 || y < 1 || y > lot.depth - 1) continue;
      const nearHouse = x > houseBounds.minX - 1.2 && x < houseBounds.maxX + 1.2 && y > houseBounds.minY - 1.2 && y < houseBounds.maxY + 1.2;
      const onPath = paths.some((path) => boundsOverlap(path.bounds, { minX: x - 0.5, maxX: x + 0.5, minY: y - 0.5, maxY: y + 0.5 }));
      if (nearHouse || onPath) continue;
      items.push({ x, y, r: 0.22 + random() * 0.2, tone: Math.floor(random() * 3) });
    }
    return items;
  }, [houseBounds, lot.depth, lot.width, paths]);
  const models = ["flowers", "bushes", "flowers", "tallGrass"] as const;
  return (
    <group>
      {flowers.map((flower, index) => {
        const [x, z] = toScene({ x: flower.x, y: flower.y }, lot);
        const model = models[(flower.tone + index) % models.length];
        const length = 1.4 + flower.r;
        const height = model === "tallGrass" ? 0.45 : model === "flowers" ? 0.4 + flower.r : 0.35 + flower.r;
        return (
          <group key={index} position={[x, 0, z]} rotation-y={flower.x * 3.1 + flower.y * 1.3}>
            <ScannedModel model={model} width={length} depth={length * 0.4} height={height} />
          </group>
        );
      })}
    </group>
  );
};


interface HedgeRun {
  x: number;
  y: number;
  width: number;
  depth: number;
}

const HEDGE_HEIGHT = 1.1;
const HEDGE_THICKNESS = 0.7;

/** Hedge runs along the lot edges, interrupted where paths reach the street. */
const hedgeRuns = (lot: Lot, paths: PathRect[]): HedgeRun[] => {
  const inset = 0.55;
  const gap = 0.5;
  const thickness = HEDGE_THICKNESS;
  const items: HedgeRun[] = [];
  const sides: { axis: "x" | "y"; at: number; from: number; to: number }[] = [
    { axis: "x", at: inset, from: inset, to: lot.width - inset },
    { axis: "x", at: lot.depth - inset, from: inset, to: lot.width - inset },
    { axis: "y", at: inset, from: inset + thickness, to: lot.depth - inset - thickness },
    { axis: "y", at: lot.width - inset, from: inset + thickness, to: lot.depth - inset - thickness },
  ];
  for (const side of sides) {
    const cuts = paths
      .filter((path) => (side.axis === "x" ? path.bounds.minY <= side.at + thickness && path.bounds.maxY >= side.at - thickness : path.bounds.minX <= side.at + thickness && path.bounds.maxX >= side.at - thickness))
      .map((path) => (side.axis === "x" ? [path.bounds.minX - gap, path.bounds.maxX + gap] : [path.bounds.minY - gap, path.bounds.maxY + gap]))
      .sort((a, b) => a[0] - b[0]);
    let cursor = side.from;
    const push = (from: number, to: number) => {
      if (to - from < 0.5) return;
      if (side.axis === "x") items.push({ x: (from + to) / 2, y: side.at, width: to - from, depth: thickness });
      else items.push({ x: side.at, y: (from + to) / 2, width: thickness, depth: to - from });
    };
    for (const [cutFrom, cutTo] of cuts) {
      push(cursor, Math.min(cutFrom, side.to));
      cursor = Math.max(cursor, cutTo);
    }
    push(cursor, side.to);
  }
  return items;
};

/** Instanced leaf cards sharing one material (one draw call). */
const FoliageCards = ({ set, material }: { set: CardSet; material: MeshStandardMaterial }) => {
  const mesh = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1);
    const attributes = cardAttributes(set);
    geometry.setAttribute("foliageNormal", attributes.foliageNormal);
    const instanced = new InstancedMesh(geometry, material, set.count);
    instanced.instanceMatrix = attributes.instanceMatrix;
    instanced.instanceColor = attributes.instanceColor;
    instanced.castShadow = true;
    instanced.receiveShadow = true;
    instanced.computeBoundingSphere();
    return instanced;
  }, [set, material]);
  useEffect(() => () => mesh.geometry.dispose(), [mesh]);
  return <primitive object={mesh} />;
};

/** Leaf atlas and the foliage materials of every species, created once per scene. */
const useFoliageMaterials = () => {
  const materials = useMemo(() => {
    const atlas = createLeafAtlas();
    return {
      atlas,
      hedge: createFoliageMaterial(atlas, "#8fae78"),
      broadleaf: createFoliageMaterial(atlas, "#cfe0a6"),
      birch: createFoliageMaterial(atlas, "#e4ef9c"),
      conifer: createFoliageMaterial(atlas, "#6f8f62"),
      core: new MeshStandardMaterial({ color: "#2c4420", roughness: 1 }),
    };
  }, []);
  useEffect(
    () => () => {
      materials.atlas.dispose();
      for (const material of [materials.hedge, materials.broadleaf, materials.birch, materials.conifer, materials.core]) material.dispose();
    },
    [materials],
  );
  return materials;
};

/** Clipped hedges: a dark core covered with thousands of leaf cards. */
export const Hedges = ({ lot, paths, quality }: { lot: Lot; paths: PathRect[]; quality: "low" | "high" }) => {
  const foliage = useFoliageMaterials();
  const runs = useMemo(() => hedgeRuns(lot, paths), [lot, paths]);
  const cards = useMemo(() => {
    const random = createRandom(lot.width * 131 + lot.depth * 17);
    const density = quality === "high" ? 95 : 45;
    const all = runs.flatMap((run) => {
      const [x, z] = toScene({ x: run.x, y: run.y }, lot);
      return hedgeCards(new Vector3(x, HEDGE_HEIGHT / 2, z), new Vector3(run.width / 2, HEDGE_HEIGHT / 2, run.depth / 2), density, [0.26, 0.42], random);
    });
    return packCards(all, random);
  }, [runs, lot, quality]);
  const coreParts = useMemo<BoxPart[]>(
    () =>
      runs.map((run) => {
        const [x, z] = toScene({ x: run.x, y: run.y }, lot);
        return { size: [Math.max(0.1, run.width - 0.16), HEDGE_HEIGHT - 0.12, Math.max(0.1, run.depth - 0.16)], position: [x, (HEDGE_HEIGHT - 0.12) / 2, z] };
      }),
    [runs, lot],
  );
  const core = useMergedBoxes(coreParts);
  return (
    <group>
      {core ? <mesh geometry={core} material={foliage.core} castShadow receiveShadow /> : null}
      <FoliageCards set={cards} material={foliage.hedge} />
    </group>
  );
};

type TreeSpecies = "broadleaf" | "birch" | "conifer";

interface TreePlacement {
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
const growTree = (tree: TreePlacement, random: () => number): { limbs: Limb[]; lobes: Lobe[] } => {
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
  const trunkHeight = (isBirch ? 2.8 : 2) * s;
  const top = base.clone().setY(trunkHeight);
  limbs.push({ start: base, end: top, bottomRadius: (isBirch ? 0.12 : 0.19) * s, topRadius: (isBirch ? 0.07 : 0.11) * s });
  const branches = isBirch ? 4 : 5 + Math.floor(random() * 3);
  for (let index = 0; index < branches; index += 1) {
    const heading = (index / branches) * Math.PI * 2 + random() * 0.9;
    const elevation = (isBirch ? 1.1 : 0.55) + random() * 0.5;
    const length = (isBirch ? 1.2 + random() * 0.9 : 1.3 + random() * 1.1) * s;
    const direction = new Vector3(Math.cos(heading) * Math.cos(elevation), Math.sin(elevation), Math.sin(heading) * Math.cos(elevation));
    const start = top.clone().addScaledVector(new Vector3(0, -1, 0), random() * (isBirch ? 1.2 : 0.5) * s);
    const end = start.clone().addScaledVector(direction, length);
    limbs.push({ start, end, bottomRadius: (isBirch ? 0.05 : 0.09) * s, topRadius: 0.025 * s });
    // Irregular crown: lobes of varied size and squash at the branch tips.
    const radius = (isBirch ? 0.55 + random() * 0.4 : 0.75 + random() * 0.6) * s;
    lobes.push({ center: end.clone().add(new Vector3((random() - 0.5) * 0.4 * s, radius * (0.1 + random() * 0.4), (random() - 0.5) * 0.4 * s)), radii: new Vector3(radius * (0.85 + random() * 0.3), radius * (isBirch ? 1.4 : 0.7 + random() * 0.35), radius * (0.85 + random() * 0.3)) });
  }
  const crown = (isBirch ? 0.85 : 1.25 + random() * 0.3) * s;
  lobes.push({ center: top.clone().add(new Vector3((random() - 0.5) * 0.5 * s, crown * (isBirch ? 1.9 : 1.15), (random() - 0.5) * 0.5 * s)), radii: new Vector3(crown, crown * (isBirch ? 1.7 : 0.85), crown * (0.9 + random() * 0.2)) });
  return { limbs, lobes };
};

/** Tapered cylinders merged into one geometry, UVs in meters so the bark keeps its scale. */
const mergeLimbs = (limbs: Limb[]): BufferGeometry | null => {
  if (limbs.length === 0) return null;
  const up = new Vector3(0, 1, 0);
  const pieces = limbs.map((limb) => {
    const axis = new Vector3().subVectors(limb.end, limb.start);
    const length = axis.length();
    const cylinder = new CylinderGeometry(limb.topRadius, limb.bottomRadius, length, 10, 1, true);
    const uv = cylinder.getAttribute("uv");
    const circumference = Math.PI * (limb.topRadius + limb.bottomRadius);
    for (let index = 0; index < uv.count; index += 1) uv.setXY(index, uv.getX(index) * circumference, uv.getY(index) * length);
    const matrix = new Matrix4().compose(limb.start.clone().addScaledVector(axis, 0.5), new Quaternion().setFromUnitVectors(up, axis.normalize()), new Vector3(1, 1, 1));
    cylinder.applyMatrix4(matrix);
    return cylinder;
  });
  const merged = mergeGeometries(pieces);
  pieces.forEach((piece) => piece.dispose());
  return merged;
};

/** Dark inner volumes of the crowns, so the sky does not shine through the leaves. */
const mergeCores = (lobes: Lobe[]): BufferGeometry | null => {
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

const useDisposable = (geometry: BufferGeometry | null) => {
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
};

/** Trees along the lot and shrubs by the house corners. */
export const Garden = ({ lot, houseBounds, paths, materials, quality }: { lot: Lot; houseBounds: Bounds; paths: PathRect[]; materials: SceneMaterials; quality: "low" | "high" }) => {
  const foliage = useFoliageMaterials();
  const { trees, shrubs } = useMemo(() => {
    const random = createRandom(lot.width * 1000 + lot.depth * 7);
    const species: TreeSpecies[] = ["broadleaf", "birch", "broadleaf", "conifer", "broadleaf", "birch"];
    const placements: TreePlacement[] = [];
    const clearance = 2.6;
    const inset = 2;
    const candidates: { x: number; y: number }[] = [];
    for (let x = inset; x <= lot.width - inset; x += 4.2) candidates.push({ x, y: inset }, { x, y: lot.depth - inset });
    for (let y = inset + 3; y <= lot.depth - inset - 3; y += 4.2) candidates.push({ x: inset, y }, { x: lot.width - inset, y });
    for (const candidate of candidates) {
      const x = candidate.x + (random() - 0.5) * 1.2;
      const y = candidate.y + (random() - 0.5) * 0.6;
      const nearHouse = x > houseBounds.minX - clearance && x < houseBounds.maxX + clearance && y > houseBounds.minY - clearance && y < houseBounds.maxY + clearance;
      const onPath = paths.some((path) => boundsOverlap(path.bounds, { minX: x - 1.6, maxX: x + 1.6, minY: y - 1.6, maxY: y + 1.6 }));
      if (nearHouse || onPath || random() < 0.35) continue;
      const [sx, sz] = toScene({ x, y }, lot);
      placements.push({ x: sx, z: sz, scale: 0.85 + random() * 0.4, species: species[Math.floor(random() * species.length)] });
    }
    const shrubs: { x: number; y: number; r: number }[] = [];
    const corners = [
      { x: houseBounds.minX - 0.8, y: houseBounds.minY - 0.8 },
      { x: houseBounds.maxX + 0.8, y: houseBounds.minY - 0.8 },
      { x: houseBounds.minX - 0.8, y: houseBounds.maxY + 0.8 },
      { x: houseBounds.maxX + 0.8, y: houseBounds.maxY + 0.8 },
    ];
    for (const corner of corners) {
      if (corner.x < 0.8 || corner.x > lot.width - 0.8 || corner.y < 0.8 || corner.y > lot.depth - 0.8) continue;
      if (paths.some((path) => boundsOverlap(path.bounds, { minX: corner.x - 0.7, maxX: corner.x + 0.7, minY: corner.y - 0.7, maxY: corner.y + 0.7 }))) continue;
      for (let index = 0; index < 3; index += 1) shrubs.push({ x: corner.x + (random() - 0.5) * 1.1, y: corner.y + (random() - 0.5) * 1.1, r: 0.3 + random() * 0.25 });
    }
    return { trees: placements, shrubs };
  }, [houseBounds, lot, paths]);

  const grown = useMemo(() => {
    const random = createRandom(trees.length * 97 + lot.width);
    return trees.map((tree) => ({ tree, ...growTree(tree, random) }));
  }, [trees, lot.width]);
  const density = quality === "high" ? 30 : 14;
  const cardsBySpecies = useMemo(() => {
    const random = createRandom(lot.depth * 53 + 11);
    const pack = (species: TreeSpecies) => {
      const lobes = grown.filter(({ tree }) => tree.species === species).flatMap(({ lobes }) => lobes);
      const size: [number, number] = species === "conifer" ? [0.45, 0.7] : [0.55, 0.9];
      return lobes.length > 0 ? packCards(lobes.flatMap((lobe) => ellipsoidCards(lobe.center, lobe.radii, density, size, random)), random) : null;
    };
    return { broadleaf: pack("broadleaf"), birch: pack("birch"), conifer: pack("conifer") };
  }, [grown, density, lot.depth]);
  const bark = useDisposable(useMemo(() => mergeLimbs(grown.filter(({ tree }) => tree.species !== "birch").flatMap(({ limbs }) => limbs)), [grown]));
  const birchBark = useDisposable(useMemo(() => mergeLimbs(grown.filter(({ tree }) => tree.species === "birch").flatMap(({ limbs }) => limbs)), [grown]));
  const cores = useDisposable(useMemo(() => mergeCores(grown.flatMap(({ lobes }) => lobes)), [grown]));
  const birchMaterial = useMemo(() => {
    const material = materials.bark.clone();
    material.map = null;
    material.color.set("#e2ded5");
    return material;
  }, [materials.bark]);
  useEffect(() => () => birchMaterial.dispose(), [birchMaterial]);

  return (
    <group>
      {bark ? <mesh geometry={bark} material={materials.bark} castShadow receiveShadow /> : null}
      {birchBark ? <mesh geometry={birchBark} material={birchMaterial} castShadow receiveShadow /> : null}
      {cores ? <mesh geometry={cores} material={foliage.core} castShadow receiveShadow /> : null}
      {cardsBySpecies.broadleaf ? <FoliageCards set={cardsBySpecies.broadleaf} material={foliage.broadleaf} /> : null}
      {cardsBySpecies.birch ? <FoliageCards set={cardsBySpecies.birch} material={foliage.birch} /> : null}
      {cardsBySpecies.conifer ? <FoliageCards set={cardsBySpecies.conifer} material={foliage.conifer} /> : null}
      {shrubs.map((shrub, index) => {
        const [x, z] = toScene({ x: shrub.x, y: shrub.y }, lot);
        return (
          <group key={index} position={[x, 0, z]} rotation-y={index * 1.7}>
            <ScannedModel model="bushes" width={shrub.r * 5} depth={shrub.r * 2} height={shrub.r * 2.2} />
          </group>
        );
      })}
    </group>
  );
};
