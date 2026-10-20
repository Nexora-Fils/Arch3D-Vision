"use client";

import { useEffect, useMemo } from "react";
import { PlaneGeometry, type BufferGeometry, type MeshStandardMaterial } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { WallOpening } from "@/domain/plan/geometry";
import { useMergedBoxes, type BoxPart } from "@/features/viewer-3d/architecture/merged-boxes";
import type { SceneMaterials } from "@/features/viewer-3d/scene-materials";

/**
 * Doors and windows built like joinery: a frame set near the interior face of
 * the wall (French practice with interior insulation), so the exterior shows a
 * deep reveal; sashes with their own profiles, glazing, stone sill outside,
 * window board inside, optional render surrounds and open timber shutters.
 * Local frame: x along the wall, y up from the floor, z toward the exterior
 * when `exteriorSide` is +1 (toward -z when it is -1).
 */

const FRAME_FACE = 0.055;
const FRAME_DEPTH = 0.07;
const SASH_FACE = 0.058;
const SASH_DEPTH = 0.06;
/** Cladding layer applied on exterior wall faces (see WallMesh). */
const CLADDING = 0.012;

export interface JoineryStyle {
  /** Open timber shutters beside the windows. */
  shutters: boolean;
  /** Smooth render bands framing the windows on the façade. */
  surrounds: boolean;
  /** Painted panelled entrance door instead of a modern wooden one. */
  traditional: boolean;
}

interface OpeningProps {
  opening: WallOpening;
  thickness: number;
  exteriorSide: 1 | -1 | 0;
  materials: SceneMaterials;
  style: JoineryStyle;
  /** Façade material: lines the reveals between the frame and the outer face. */
  facade: MeshStandardMaterial;
}

/** z of the frame center: 3 cm from the interior face of exterior walls, centered in interior walls. */
const frameCenter = (thickness: number, exteriorSide: 1 | -1 | 0, depth: number): number =>
  exteriorSide === 0 ? 0 : -exteriorSide * (thickness / 2 - depth / 2 - 0.03);

/** Four profiles of a rectangular frame (jambs, head, bottom rail). */
const rectangleFrame = (left: number, right: number, bottom: number, top: number, face: number, depth: number, z: number): BoxPart[] => [
  { size: [face, top - bottom, depth], position: [left + face / 2, (bottom + top) / 2, z] },
  { size: [face, top - bottom, depth], position: [right - face / 2, (bottom + top) / 2, z] },
  { size: [right - left - face * 2, face, depth], position: [(left + right) / 2, top - face / 2, z] },
  { size: [right - left - face * 2, face, depth], position: [(left + right) / 2, bottom + face / 2, z] },
];

/**
 * Linings of the exterior reveal (jambs and head, optionally the sill side)
 * from the outer face of the frame to the façade, in the façade material.
 */
const revealParts = (left: number, right: number, bottom: number, top: number, frameOuter: number, thickness: number, outward: 1 | -1): BoxPart[] => {
  const outer = thickness / 2 + CLADDING;
  const depth = outer - frameOuter;
  if (depth <= 0.01) return [];
  const z = outward * (frameOuter + depth / 2);
  const lining = 0.012;
  return [
    { size: [lining, top - bottom, depth], position: [left + lining / 2, (bottom + top) / 2, z] },
    { size: [lining, top - bottom, depth], position: [right - lining / 2, (bottom + top) / 2, z] },
    { size: [right - left, lining, depth], position: [(left + right) / 2, top - lining / 2, z] },
  ];
};

/** Glass planes facing +z (or -z), merged into one geometry. */
const usePanes = (panes: { width: number; height: number; x: number; y: number; z: number }[], facing: 1 | -1): BufferGeometry | null => {
  const geometry = useMemo(() => {
    if (panes.length === 0) return null;
    const planes = panes.map(({ width, height, x, y, z }) => {
      const plane = new PlaneGeometry(width, height);
      if (facing === -1) plane.rotateY(Math.PI);
      plane.translate(x, y, z);
      return plane;
    });
    const merged = mergeGeometries(planes);
    planes.forEach((plane) => plane.dispose());
    return merged;
  }, [panes, facing]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
};

export const WindowUnit = ({ opening, thickness, exteriorSide, materials, style, facade, isLit }: OpeningProps & { isLit: boolean }) => {
  const { width, height, sillHeight } = opening;
  const isExterior = exteriorSide !== 0;
  const outward = exteriorSide === 0 ? 1 : exteriorSide;
  const zFrame = frameCenter(thickness, exteriorSide, FRAME_DEPTH);
  const zSash = zFrame + outward * 0.006;
  const bottom = sillHeight;
  const top = sillHeight + height;
  const left = -width / 2;
  const right = width / 2;
  // French casements: one leaf per ~75 cm of width.
  const leaves = Math.max(1, Math.min(4, Math.round(width / 0.75)));
  const innerLeft = left + FRAME_FACE;
  const innerWidth = width - FRAME_FACE * 2;
  const leafWidth = innerWidth / leaves;
  const withShutters = style.shutters && isExterior && width >= 0.6 && width <= 1.7 && height >= 0.8;
  const withSurrounds = style.surrounds && isExterior;
  const surround = withSurrounds ? 0.15 : 0;
  const faceZ = outward * (thickness / 2 + CLADDING);

  const frameParts = useMemo<BoxPart[]>(() => {
    const parts = rectangleFrame(left, right, bottom, top, FRAME_FACE, FRAME_DEPTH, zFrame);
    for (let index = 0; index < leaves; index += 1) {
      const leafLeft = innerLeft + index * leafWidth;
      parts.push(...rectangleFrame(leafLeft, leafLeft + leafWidth, bottom + FRAME_FACE, top - FRAME_FACE, SASH_FACE, SASH_DEPTH, zSash));
    }
    return parts;
  }, [left, right, bottom, top, zFrame, zSash, leaves, innerLeft, leafWidth]);

  const panes = useMemo(
    () =>
      Array.from({ length: leaves }, (_, index) => ({
        width: leafWidth - SASH_FACE * 2,
        height: height - FRAME_FACE * 2 - SASH_FACE * 2,
        x: innerLeft + (index + 0.5) * leafWidth,
        y: (bottom + top) / 2,
        z: zSash,
      })),
    [leaves, leafWidth, height, innerLeft, bottom, top, zSash],
  );
  const litPanes = useMemo(() => (isLit ? panes.map((pane) => ({ ...pane, z: pane.z + outward * 0.004 })) : []), [isLit, panes, outward]);

  const stoneParts = useMemo<BoxPart[]>(() => {
    if (!isExterior) return [];
    // From the outer face of the frame to 5 cm beyond the façade.
    const sillDepth = thickness / 2 + CLADDING + 0.05 - (zFrame * outward + FRAME_DEPTH / 2);
    const parts: BoxPart[] = [
      {
        size: [width + 0.1 + surround * 2, 0.05, sillDepth],
        position: [0, bottom - 0.02, outward * (zFrame * outward + FRAME_DEPTH / 2 + sillDepth / 2)],
      },
    ];
    if (withSurrounds) {
      parts.push(
        { size: [surround, height + 0.2, 0.02], position: [left - surround / 2, bottom + (height + 0.2) / 2, faceZ + outward * 0.01] },
        { size: [surround, height + 0.2, 0.02], position: [right + surround / 2, bottom + (height + 0.2) / 2, faceZ + outward * 0.01] },
        { size: [width, 0.2, 0.02], position: [0, top + 0.1, faceZ + outward * 0.01] },
      );
    }
    return parts;
  }, [isExterior, zFrame, thickness, outward, width, surround, bottom, withSurrounds, height, left, right, top, faceZ]);

  const boardParts = useMemo<BoxPart[]>(() => {
    if (!isExterior || sillHeight < 0.3) return [];
    const frameInner = zFrame * outward - FRAME_DEPTH / 2;
    const depth = frameInner + thickness / 2 + 0.03;
    return [{ size: [width + 0.06, 0.025, depth], position: [0, bottom + 0.0125, outward * (frameInner - depth / 2)] }];
  }, [isExterior, sillHeight, zFrame, outward, thickness, width, bottom]);

  const shutterParts = useMemo<BoxPart[]>(() => {
    if (!withShutters) return [];
    const leaf = width / 2 + 0.02;
    const leafHeight = height + 0.02;
    const z = faceZ + outward * 0.03;
    const parts: BoxPart[] = [];
    for (const side of [-1, 1]) {
      const x = side * (width / 2 + surround + 0.02 + leaf / 2);
      // Vertical boards (box rotated so the plank texture runs upward), two battens and a diagonal brace.
      parts.push({ size: [leafHeight, leaf, 0.032], position: [x, bottom + height / 2, z], rotation: [0, 0, Math.PI / 2] });
      for (const t of [0.17, 0.83]) parts.push({ size: [leaf - 0.05, 0.1, 0.022], position: [x, bottom + leafHeight * t, z + outward * 0.026] });
      const rise = leafHeight * 0.66 - 0.1;
      const run = leaf - 0.12;
      parts.push({ size: [Math.hypot(rise, run), 0.09, 0.022], position: [x, bottom + leafHeight / 2, z + outward * 0.026], rotation: [0, 0, side * Math.atan2(rise, run)] });
    }
    return parts;
  }, [withShutters, width, height, faceZ, outward, surround, bottom]);

  const revealLinings = useMemo<BoxPart[]>(
    () => (isExterior ? revealParts(left, right, bottom, top, zFrame * outward + FRAME_DEPTH / 2, thickness, outward) : []),
    [isExterior, left, right, bottom, top, zFrame, outward, thickness],
  );

  const frame = useMergedBoxes(frameParts);
  const stone = useMergedBoxes(stoneParts);
  const board = useMergedBoxes(boardParts);
  const shutters = useMergedBoxes(shutterParts);
  const reveals = useMergedBoxes(revealLinings);
  const glass = usePanes(panes, outward);
  const lit = usePanes(litPanes, outward);

  return (
    <group position-x={opening.offset}>
      {frame ? <mesh geometry={frame} material={materials.frame} castShadow receiveShadow /> : null}
      {reveals ? <mesh geometry={reveals} material={facade} receiveShadow /> : null}
      {glass ? <mesh geometry={glass} material={materials.glass} /> : null}
      {lit ? <mesh geometry={lit} material={materials.glassLit} /> : null}
      {stone ? <mesh geometry={stone} material={withSurrounds ? materials.surround : materials.sill} castShadow receiveShadow /> : null}
      {board ? <mesh geometry={board} material={materials.trim} receiveShadow /> : null}
      {shutters ? <mesh geometry={shutters} material={materials.shutter} castShadow receiveShadow /> : null}
    </group>
  );
};

/** Exterior doors at least this wide, without a leaf, are garage doors. */
const GARAGE_MIN_WIDTH = 2.2;

export const isGarageDoor = (opening: WallOpening, exteriorSide: 1 | -1 | 0): boolean =>
  exteriorSide !== 0 && opening.kind === "door" && opening.doorType === "opening" && opening.width >= GARAGE_MIN_WIDTH;

export const DoorUnit = ({ opening, thickness, exteriorSide, materials, style, facade, isOpen }: OpeningProps & { isOpen: boolean }) => {
  if (isGarageDoor(opening, exteriorSide)) return <GarageDoor opening={opening} thickness={thickness} exteriorSide={exteriorSide} materials={materials} facade={facade} isOpen={isOpen} />;
  if (opening.doorType === "sliding") return <SlidingDoor opening={opening} thickness={thickness} exteriorSide={exteriorSide} materials={materials} facade={facade} isOpen={isOpen} />;
  if (opening.doorType === "opening") return exteriorSide === 0 ? <Casings opening={opening} thickness={thickness} materials={materials} /> : null;
  return <HingedDoor opening={opening} thickness={thickness} exteriorSide={exteriorSide} materials={materials} style={style} facade={facade} isOpen={isOpen} />;
};

/** Painted wooden casings around an interior opening, on both faces, plus the lining of its reveal. */
const Casings = ({ opening, thickness, materials }: Pick<OpeningProps, "opening" | "thickness" | "materials">) => {
  const { width, height } = opening;
  const parts = useMemo<BoxPart[]>(() => {
    const casing = 0.07;
    const items: BoxPart[] = [];
    for (const side of [-1, 1]) {
      const z = side * (thickness / 2 + 0.006);
      items.push(
        { size: [casing, height + casing, 0.012], position: [-width / 2 - casing / 2 + 0.01, (height + casing) / 2, z] },
        { size: [casing, height + casing, 0.012], position: [width / 2 + casing / 2 - 0.01, (height + casing) / 2, z] },
        { size: [width + casing * 2 - 0.02, casing, 0.012], position: [0, height + casing / 2, z] },
      );
    }
    items.push(
      { size: [0.018, height, thickness], position: [-width / 2 + 0.009, height / 2, 0] },
      { size: [0.018, height, thickness], position: [width / 2 - 0.009, height / 2, 0] },
      { size: [width, 0.018, thickness], position: [0, height - 0.009, 0] },
    );
    return items;
  }, [width, height, thickness]);
  const geometry = useMergedBoxes(parts);
  return geometry ? <mesh geometry={geometry} position-x={opening.offset} material={materials.trim} receiveShadow /> : null;
};

/** Stone threshold under an exterior door, from the frame to 10 cm beyond the façade. */
const thresholdPart = (width: number, thickness: number, exteriorSide: 1 | -1, zFrame: number): BoxPart => {
  const from = zFrame * exteriorSide;
  const to = thickness / 2 + CLADDING + 0.1;
  return { size: [width + 0.1, 0.04, to - from], position: [0, 0.005, exteriorSide * ((from + to) / 2)] };
};

const HingedDoor = ({ opening, thickness, exteriorSide, materials, style, facade, isOpen }: OpeningProps & { isOpen: boolean }) => {
  const { width, height } = opening;
  const isExterior = exteriorSide !== 0;
  const outward = exteriorSide === 0 ? 1 : exteriorSide;
  const depth = isExterior ? 0.09 : thickness + 0.01;
  const zFrame = frameCenter(thickness, exteriorSide, depth);
  const isLeft = opening.swing !== "right";
  const leafWidth = width - FRAME_FACE * 2 - 0.01;
  const leafHeight = height - FRAME_FACE - 0.01;
  const openAngle = isOpen ? (80 * Math.PI) / 180 : 0;
  const hingeX = isLeft ? -width / 2 + FRAME_FACE : width / 2 - FRAME_FACE;
  const direction = isLeft ? 1 : -1;
  const leafZ = isExterior ? zFrame : outward * (thickness / 2 - 0.03);

  const frameParts = useMemo<BoxPart[]>(() => {
    const parts: BoxPart[] = [
      { size: [FRAME_FACE, height, depth], position: [-width / 2 + FRAME_FACE / 2, height / 2, zFrame] },
      { size: [FRAME_FACE, height, depth], position: [width / 2 - FRAME_FACE / 2, height / 2, zFrame] },
      { size: [width, FRAME_FACE, depth], position: [0, height - FRAME_FACE / 2, zFrame] },
    ];
    if (!isExterior) {
      // Casings on both faces of interior walls.
      for (const side of [-1, 1]) {
        const z = side * (thickness / 2 + 0.006);
        parts.push(
          { size: [0.07, height + 0.07, 0.012], position: [-width / 2 - 0.025, (height + 0.07) / 2, z] },
          { size: [0.07, height + 0.07, 0.012], position: [width / 2 + 0.025, (height + 0.07) / 2, z] },
          { size: [width + 0.12, 0.07, 0.012], position: [0, height + 0.035, z] },
        );
      }
    }
    return parts;
  }, [width, height, depth, zFrame, isExterior, thickness]);

  // Leaf in its own frame, hinged at the jamb: panels or grooves are drawn on both faces.
  const leafParts = useMemo<BoxPart[]>(() => {
    const parts: BoxPart[] = [{ size: [leafWidth, leafHeight, 0.045], position: [direction * leafWidth / 2, leafHeight / 2, 0] }];
    if (isExterior && style.traditional) {
      // Two raised panels per face.
      for (const face of [-1, 1]) {
        for (const [y, h] of [[leafHeight * 0.72, leafHeight * 0.38], [leafHeight * 0.26, leafHeight * 0.34]] as const) {
          parts.push({ size: [leafWidth - 0.22, h, 0.012], position: [direction * leafWidth / 2, y, face * 0.026] });
        }
      }
    }
    return parts;
  }, [leafWidth, leafHeight, direction, isExterior, style.traditional]);

  const grooveParts = useMemo<BoxPart[]>(() => {
    if (!isExterior || style.traditional) return [];
    // Modern entrance door: three vertical grooves on the outer face.
    return [0.3, 0.5, 0.7].map((t) => ({ size: [0.012, leafHeight - 0.3, 0.004], position: [direction * leafWidth * t, leafHeight / 2, outward * 0.0235] }));
  }, [isExterior, style.traditional, leafHeight, direction, leafWidth, outward]);

  const thresholdParts = useMemo<BoxPart[]>(() => (isExterior ? [thresholdPart(width, thickness, outward, zFrame)] : []), [isExterior, width, thickness, outward, zFrame]);
  const revealLinings = useMemo<BoxPart[]>(
    () => (isExterior ? revealParts(-width / 2, width / 2, 0, height, zFrame * outward + depth / 2, thickness, outward) : []),
    [isExterior, width, height, zFrame, outward, depth, thickness],
  );

  const frame = useMergedBoxes(frameParts);
  const leaf = useMergedBoxes(leafParts);
  const grooves = useMergedBoxes(grooveParts);
  const threshold = useMergedBoxes(thresholdParts);
  const reveals = useMergedBoxes(revealLinings);
  const leafMaterial = isExterior ? (style.traditional ? materials.shutter : materials.doorLeaf) : materials.trim;

  return (
    <group position-x={opening.offset}>
      {frame ? <mesh geometry={frame} material={isExterior ? materials.frame : materials.trim} castShadow receiveShadow /> : null}
      {reveals ? <mesh geometry={reveals} material={facade} receiveShadow /> : null}
      {threshold ? <mesh geometry={threshold} material={materials.sill} receiveShadow /> : null}
      <group position={[hingeX, 0.005, leafZ]} rotation-y={direction * openAngle}>
        {leaf ? <mesh geometry={leaf} material={leafMaterial} castShadow receiveShadow /> : null}
        {grooves ? <mesh geometry={grooves} material={materials.fascia} /> : null}
        {isExterior && !style.traditional ? (
          // Long bar pull outside.
          <mesh position={[direction * (leafWidth - 0.12), 1.05, outward * 0.07]} material={materials.metal} castShadow>
            <boxGeometry args={[0.03, 0.7, 0.03]} />
          </mesh>
        ) : null}
        {/* Lever handles with roses on both faces. */}
        {[-1, 1].map((face) =>
          isExterior && !style.traditional && face === outward ? null : (
            <group key={face} position={[direction * (leafWidth - 0.07), 1.02, face * 0.03]}>
              <mesh rotation-x={Math.PI / 2} material={materials.metal}>
                <cylinderGeometry args={[0.025, 0.025, 0.012, 16]} />
              </mesh>
              <mesh position={[-direction * 0.055, 0, face * 0.035]} rotation-z={Math.PI / 2} material={materials.metal} castShadow>
                <cylinderGeometry args={[0.01, 0.01, 0.12, 10]} />
              </mesh>
            </group>
          ),
        )}
      </group>
    </group>
  );
};

/** Lift-and-slide bay: heavy frame near the interior face, two glazed panels on two tracks. */
const SlidingDoor = ({ opening, thickness, exteriorSide, materials, facade, isOpen }: Omit<OpeningProps, "style"> & { isOpen: boolean }) => {
  const { width, height } = opening;
  const outward = exteriorSide === 0 ? 1 : exteriorSide;
  const depth = 0.1;
  const zFrame = frameCenter(thickness, exteriorSide, depth);
  const panelWidth = (width - FRAME_FACE * 2) / 2 + 0.03;
  const panelHeight = height - FRAME_FACE * 2;
  const profile = 0.07;
  // Outer track: fixed panel; inner track: slides over it in walk mode.
  const tracks = useMemo(
    () => [
      { x: -(width / 2 - FRAME_FACE - panelWidth / 2), z: zFrame + outward * 0.022 },
      { x: isOpen ? -width / 2 + FRAME_FACE + panelWidth / 2 : width / 2 - FRAME_FACE - panelWidth / 2, z: zFrame - outward * 0.022 },
    ],
    [width, panelWidth, zFrame, outward, isOpen],
  );

  const frameParts = useMemo<BoxPart[]>(() => {
    const parts = rectangleFrame(-width / 2, width / 2, 0, height, FRAME_FACE, depth, zFrame);
    for (const track of tracks) {
      parts.push(...rectangleFrame(track.x - panelWidth / 2, track.x + panelWidth / 2, FRAME_FACE, FRAME_FACE + panelHeight, profile, 0.045, track.z));
    }
    if (exteriorSide !== 0) parts.push(thresholdPart(width, thickness, outward, zFrame));
    return parts;
  }, [width, height, depth, zFrame, tracks, panelWidth, panelHeight, outward, exteriorSide, thickness]);

  const panes = useMemo(
    () => tracks.map((track) => ({ width: panelWidth - profile * 2, height: panelHeight - profile * 2, x: track.x, y: FRAME_FACE + panelHeight / 2, z: track.z })),
    [tracks, panelWidth, panelHeight],
  );
  const revealLinings = useMemo<BoxPart[]>(
    () => (exteriorSide !== 0 ? revealParts(-width / 2, width / 2, 0, height, zFrame * outward + depth / 2, thickness, outward) : []),
    [exteriorSide, width, height, zFrame, outward, depth, thickness],
  );
  const frame = useMergedBoxes(frameParts);
  const reveals = useMergedBoxes(revealLinings);
  const glass = usePanes(panes, outward);
  return (
    <group position-x={opening.offset}>
      {frame ? <mesh geometry={frame} material={materials.frame} castShadow receiveShadow /> : null}
      {reveals ? <mesh geometry={reveals} material={facade} receiveShadow /> : null}
      {glass ? <mesh geometry={glass} material={materials.glass} /> : null}
    </group>
  );
};

/** Sectional garage door set behind the opening; rolled up under the ceiling during the walkthrough. */
const GarageDoor = ({ opening, thickness, exteriorSide, materials, facade, isOpen }: Omit<OpeningProps, "style"> & { isOpen: boolean }) => {
  const { width, height } = opening;
  const outward = exteriorSide === 0 ? 1 : exteriorSide;
  const sections = Math.max(3, Math.round(height / 0.55));
  const parts = useMemo<BoxPart[]>(() => [{ size: [width + 0.04, height + 0.02, 0.045], position: [0, 0, 0] }], [width, height]);
  const grooveParts = useMemo<BoxPart[]>(
    () => Array.from({ length: sections - 1 }, (_, index) => ({ size: [width, 0.012, 0.01], position: [0, -height / 2 + ((index + 1) * height) / sections, outward * 0.024] })),
    [sections, width, height, outward],
  );
  const revealLinings = useMemo<BoxPart[]>(() => revealParts(-width / 2, width / 2, 0, height, -thickness / 2, thickness, outward), [width, height, thickness, outward]);
  const panel = useMergedBoxes(parts);
  const grooves = useMergedBoxes(grooveParts);
  const reveals = useMergedBoxes(revealLinings);
  const z = -outward * (thickness / 2 + 0.03);
  return (
    <group position={[opening.offset, 0, 0]}>
      {reveals ? <mesh geometry={reveals} material={facade} receiveShadow /> : null}
      <group position={isOpen ? [0, height + 0.08, z - outward * (height / 2)] : [0, height / 2, z]} rotation-x={isOpen ? Math.PI / 2 : 0}>
        {panel ? <mesh geometry={panel} material={materials.frame} castShadow receiveShadow /> : null}
        {grooves ? <mesh geometry={grooves} material={materials.fascia} /> : null}
      </group>
    </group>
  );
};
