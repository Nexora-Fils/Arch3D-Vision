"use client";

import { useEffect, useMemo } from "react";
import { CylinderGeometry, type MeshStandardMaterial } from "three";
import { buildWallSegments, floorBounds, isOutdoorRoom, isPointInRoom, type Bounds } from "@/domain/plan/geometry";
import type { Floor, Lot, PlanSettings } from "@/domain/plan/schema";
import { AlongSegment, MetricBox, segmentLength, type Segment } from "@/features/viewer-3d/architecture/parts";
import { toScene } from "@/features/viewer-3d/convert";
import { buildPitchedRoof, type PitchedRoof } from "@/features/viewer-3d/roof-geometry";
import type { SceneMaterials } from "@/features/viewer-3d/scene-materials";

type Triple = [number, number, number];

/** Covering thickness perpendicular to the slope: rafters, battens and tiles (m). */
const COVERING_THICKNESS = 0.22;
/** Below this overhang a flat roof gets a parapet; above it, a projecting slab (m). */
const FLAT_CANOPY_MIN_OVERHANG = 0.2;
const PARAPET_HEIGHT = 0.45;
const GUTTER_RADIUS = 0.075;
const DOWNPIPE_RADIUS = 0.045;

interface RoofAssemblyProps {
  /** Top floor (the roof covers its indoor footprint). */
  floor: Floor;
  /** Floors below, to keep downpipes off lower roofs and terraces. */
  lowerFloors: Floor[];
  settings: PlanSettings;
  /** World height of the top of the walls. */
  base: number;
  lot: Lot;
  materials: SceneMaterials;
  covering: MeshStandardMaterial;
  facade: MeshStandardMaterial;
  /** Clay roofs get round ridge tiles; slate and dark tiles a flat ridge. */
  isClay: boolean;
}

/**
 * Roof built from parts: covering, soffits, masonry gables, fascia and verge
 * boards, ridge and hip caps, half-round gutters with downpipes and a chimney
 * for pitched roofs; a parapet with metal coping (or a projecting slab) for
 * flat roofs.
 */
export const RoofAssembly = ({ floor, lowerFloors, settings, base, lot, materials, covering, facade, isClay }: RoofAssemblyProps) => {
  const footprint = useMemo(() => roofFootprint(floor), [floor]);
  if (!footprint) return null;
  const [x, z] = toScene({ x: (footprint.bounds.minX + footprint.bounds.maxX) / 2, y: (footprint.bounds.minY + footprint.bounds.maxY) / 2 }, lot);
  const width = footprint.bounds.maxX - footprint.bounds.minX + footprint.wallThickness;
  const depth = footprint.bounds.maxY - footprint.bounds.minY + footprint.wallThickness;
  return (
    <group position={[x, base, z]}>
      {settings.roofType === "flat" ? (
        <FlatRoof width={width} depth={depth} wallThickness={footprint.wallThickness} overhang={settings.roofOverhang} materials={materials} covering={covering} facade={facade} />
      ) : (
        <PitchedRoofParts
          type={settings.roofType}
          width={width}
          depth={depth}
          pitch={settings.roofPitch}
          overhang={settings.roofOverhang}
          base={base}
          center={{ x: (footprint.bounds.minX + footprint.bounds.maxX) / 2, y: (footprint.bounds.minY + footprint.bounds.maxY) / 2 }}
          lowerFloors={lowerFloors}
          solarPanels={settings.solarPanels}
          materials={materials}
          covering={covering}
          facade={facade}
          isClay={isClay}
        />
      )}
    </group>
  );
};

/** Indoor bounds of the floor (wall axes) and the thickness of its exterior walls. */
const roofFootprint = (floor: Floor): { bounds: Bounds; wallThickness: number } | null => {
  const bounds = floorBounds(floor, { indoorOnly: true });
  if (!bounds) return null;
  const exterior = buildWallSegments(floor).filter((segment) => segment.exteriorSide !== 0);
  const wallThickness = exterior.length > 0 ? Math.max(...exterior.map((segment) => segment.thickness)) : 0.3;
  return { bounds, wallThickness };
};

interface PitchedRoofPartsProps {
  type: "gable" | "hip";
  width: number;
  depth: number;
  pitch: number;
  overhang: number;
  base: number;
  /** Plan coordinates of the footprint center (to test downpipe positions against lower floors). */
  center: { x: number; y: number };
  lowerFloors: Floor[];
  solarPanels: boolean;
  materials: SceneMaterials;
  covering: MeshStandardMaterial;
  facade: MeshStandardMaterial;
  isClay: boolean;
}

const PitchedRoofParts = ({ type, width, depth, pitch, overhang, base, center, lowerFloors, solarPanels, materials, covering, facade, isClay }: PitchedRoofPartsProps) => {
  const roof = useMemo(() => buildPitchedRoof({ type, width, depth, pitchDegrees: pitch, overhang, thickness: COVERING_THICKNESS }), [type, width, depth, pitch, overhang]);
  useEffect(
    () => () => {
      roof.covering.dispose();
      roof.soffit.dispose();
      roof.gables.dispose();
    },
    [roof],
  );
  const lift = COVERING_THICKNESS / Math.cos((pitch * Math.PI) / 180);
  const lowerIndoor = useMemo(() => lowerFloors.flatMap((item) => item.rooms.filter((room) => !isOutdoorRoom(room))), [lowerFloors]);
  // A downpipe runs to the ground only where no lower roof or terrace lies under the corner.
  const reachesGround = (point: Triple) => !lowerIndoor.some((room) => isPointInRoom(room, { x: center.x + point[0], y: center.y + point[2] }));
  return (
    <group>
      <mesh geometry={roof.covering} material={covering} castShadow receiveShadow />
      <mesh geometry={roof.soffit} material={materials.soffit} receiveShadow />
      <mesh geometry={roof.gables} material={facade} castShadow receiveShadow />
      {roof.eaves.map((eave, index) => (
        // One downpipe per long eave, at opposite corners.
        <Eave key={index} eave={eave} pipeAt={index === 0 ? "end" : index === 1 ? "start" : null} lift={lift} width={width} depth={depth} overhang={overhang} groundDrop={base} reachesGround={reachesGround} materials={materials} />
      ))}
      {roof.verges.map((verge, index) => (
        <AlongSegment key={index} segment={verge}>
          <MetricBox size={[segmentLength(verge) + 0.02, lift + 0.08, 0.03]} position={[0, -(lift + 0.08) / 2 + 0.02, 0]} material={materials.fascia} castShadow />
        </AlongSegment>
      ))}
      {[...roof.ridges, ...roof.hips].map((ridge, index) => (
        <RidgeCap key={index} segment={ridge} isClay={isClay} material={covering} materials={materials} />
      ))}
      <Chimney roof={roof} lift={lift} facade={facade} materials={materials} />
      {solarPanels ? <SolarArray roof={roof} width={width} depth={depth} overhang={overhang} lift={lift} pitch={pitch} materials={materials} /> : null}
    </group>
  );
};

interface EaveProps {
  eave: Segment;
  /** End of the eave that gets a downpipe, if any. */
  pipeAt: "start" | "end" | null;
  lift: number;
  width: number;
  depth: number;
  overhang: number;
  /** Height of the wall tops above the ground (m). */
  groundDrop: number;
  reachesGround: (point: Triple) => boolean;
  materials: SceneMaterials;
}

/** Fascia board, half-round gutter and, optionally, a downpipe with its swan neck at one end. */
const Eave = ({ eave, pipeAt, lift, width, depth, overhang, groundDrop, reachesGround, materials }: EaveProps) => {
  const middle: Triple = [(eave.start[0] + eave.end[0]) / 2, eave.start[1], (eave.start[2] + eave.end[2]) / 2];
  // Horizontal direction from the roof center toward this eave.
  const outward: Triple = Math.abs(middle[0]) > Math.abs(middle[2]) ? [Math.sign(middle[0]), 0, 0] : [0, 0, Math.sign(middle[2])];
  const length = segmentLength(eave);
  const gutterOffset = 0.03 + GUTTER_RADIUS;
  const gutter: Segment = {
    start: [eave.start[0] + outward[0] * gutterOffset, eave.start[1] + lift * 0.35, eave.start[2] + outward[2] * gutterOffset],
    end: [eave.end[0] + outward[0] * gutterOffset, eave.end[1] + lift * 0.35, eave.end[2] + outward[2] * gutterOffset],
  };
  // Downpipe against the wall face, 20 cm from the corner under the chosen end of the gutter.
  const alongX = Math.abs(eave.end[0] - eave.start[0]) > Math.abs(eave.end[2] - eave.start[2]);
  const pipeEnd = pipeAt === "start" ? eave.start : eave.end;
  const alongCoord = (Math.sign(alongX ? pipeEnd[0] : pipeEnd[2]) || 1) * ((alongX ? width : depth) / 2 - 0.2);
  const acrossCoord = (alongX ? outward[2] : outward[0]) * ((alongX ? depth : width) / 2 + 0.07);
  const pipe: Triple = alongX ? [alongCoord, 0, acrossCoord] : [acrossCoord, 0, alongCoord];
  const neckTop = gutter.end[1] - 0.05;
  const neckLength = overhang + gutterOffset - 0.07;
  const hasPipe = pipeAt !== null && groundDrop > 0.5 && reachesGround(pipe);
  const pipeLength = neckTop - 0.25 + groundDrop;
  return (
    <group>
      <AlongSegment segment={eave}>
        <MetricBox size={[length + 0.03, lift + 0.08, 0.03]} position={[0, (lift - 0.08) / 2, 0]} material={materials.fascia} castShadow />
      </AlongSegment>
      <AlongSegment segment={gutter}>
        <HalfPipe length={length + 0.06} radius={GUTTER_RADIUS} material={materials.gutter} />
      </AlongSegment>
      {hasPipe ? (
        <group>
          <mesh position={[pipe[0] + outward[0] * (neckLength / 2), neckTop - 0.12, pipe[2] + outward[2] * (neckLength / 2)]} rotation={outward[0] !== 0 ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]} material={materials.gutter} castShadow>
            <cylinderGeometry args={[DOWNPIPE_RADIUS, DOWNPIPE_RADIUS, neckLength + 0.05, 12]} />
          </mesh>
          <mesh position={[pipe[0], neckTop - 0.12 - pipeLength / 2, pipe[2]]} material={materials.gutter} castShadow>
            <cylinderGeometry args={[DOWNPIPE_RADIUS, DOWNPIPE_RADIUS, pipeLength, 12]} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
};

/** Half cylinder lying along local x, open upward (gutters) or downward (round ridge tiles). */
const HalfPipe = ({ length, radius, material, openDown = false }: { length: number; radius: number; material: MeshStandardMaterial; openDown?: boolean }) => {
  const geometry = useMemo(() => {
    const shell = new CylinderGeometry(radius, radius, length, 14, 1, true, openDown ? Math.PI : 0, Math.PI);
    shell.rotateZ(-Math.PI / 2);
    return shell;
  }, [length, radius, openDown]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
};

const RidgeCap = ({ segment, isClay, material, materials }: { segment: Segment; isClay: boolean; material: MeshStandardMaterial; materials: SceneMaterials }) => (
  <AlongSegment segment={segment}>
    {isClay ? (
      <group position-y={-0.02}>
        <HalfPipe length={segmentLength(segment) + 0.1} radius={0.13} material={material} openDown />
      </group>
    ) : (
      <MetricBox size={[segmentLength(segment) + 0.1, 0.05, 0.34]} position={[0, 0.01, 0]} material={materials.ridgeMetal} castShadow />
    )}
  </AlongSegment>
);

/** Rendered masonry stack through the ridge, concrete cap and two terracotta flue pots. */
const Chimney = ({ roof, lift, facade, materials }: { roof: PitchedRoof; lift: number; facade: MeshStandardMaterial; materials: SceneMaterials }) => {
  const [ridge] = roof.ridges;
  if (!ridge) return null;
  const t = 0.28;
  const x = ridge.start[0] + (ridge.end[0] - ridge.start[0]) * t;
  const z = ridge.start[2] + (ridge.end[2] - ridge.start[2]) * t;
  const bottom = roof.ridgeHeight - 1.1;
  const top = roof.ridgeHeight + lift + 0.95;
  const height = top - bottom;
  const [sx, sz] = roof.ridgeAlongX ? [0.62, 0.5] : [0.5, 0.62];
  return (
    <group position={[x, 0, z]}>
      <MetricBox size={[sx, height, sz]} position={[0, bottom + height / 2, 0]} material={facade} castShadow />
      <MetricBox size={[sx + 0.12, 0.08, sz + 0.12]} position={[0, top + 0.04, 0]} material={materials.sill} castShadow />
      {[-0.13, 0.13].map((offset) => (
        <mesh key={offset} position={[roof.ridgeAlongX ? offset : 0, top + 0.22, roof.ridgeAlongX ? 0 : offset]} material={materials.terracotta} castShadow>
          <cylinderGeometry args={[0.07, 0.085, 0.3, 14]} />
        </mesh>
      ))}
    </group>
  );
};

/** Two rows of photovoltaic panels on the slope facing +z (or +x when the ridge runs along z). */
const SolarArray = ({ roof, width, depth, overhang, lift, pitch, materials }: { roof: PitchedRoof; width: number; depth: number; overhang: number; lift: number; pitch: number; materials: SceneMaterials }) => {
  const halfSpan = Math.min(width, depth) / 2;
  const long = Math.max(width, depth);
  const angle = (pitch * Math.PI) / 180;
  const panelWidth = 1.05;
  const panelHeight = 1.7;
  const gap = 0.04;
  const columns = Math.max(2, Math.min(8, Math.floor((long * 0.55) / (panelWidth + gap))));
  const arrayWidth = columns * (panelWidth + gap) - gap;
  // Middle of the slope, measured horizontally from the ridge.
  const along = (halfSpan + overhang) / 2;
  const y = roof.ridgeHeight - along * Math.tan(angle) + lift + 0.08;
  return (
    <group rotation-y={roof.ridgeAlongX ? 0 : Math.PI / 2}>
      <group position={[0, y, along]} rotation-x={angle}>
        {[0, 1].flatMap((row) =>
          Array.from({ length: columns }, (_, column) => (
            <group key={`${row}-${column}`} position={[-arrayWidth / 2 + column * (panelWidth + gap) + panelWidth / 2, 0, (row - 0.5) * (panelHeight + gap)]}>
              <mesh material={materials.metal} castShadow>
                <boxGeometry args={[panelWidth, 0.04, panelHeight]} />
              </mesh>
              <mesh position-y={0.022} material={materials.solar}>
                <boxGeometry args={[panelWidth - 0.04, 0.008, panelHeight - 0.04]} />
              </mesh>
            </group>
          )),
        )}
      </group>
    </group>
  );
};

interface FlatRoofProps {
  width: number;
  depth: number;
  wallThickness: number;
  overhang: number;
  materials: SceneMaterials;
  covering: MeshStandardMaterial;
  facade: MeshStandardMaterial;
}

/**
 * Flat roof: a parapet (acrotère) in the façade material topped by a metal
 * coping, gravel inside; or, with a real overhang, a thin projecting slab
 * with a low upstand.
 */
const FlatRoof = ({ width, depth, wallThickness, overhang, materials, covering, facade }: FlatRoofProps) => {
  if (overhang >= FLAT_CANOPY_MIN_OVERHANG) {
    const slabWidth = width + overhang * 2;
    const slabDepth = depth + overhang * 2;
    const slab = 0.24;
    const upstand = 0.12;
    const edge = 0.14;
    return (
      <group>
        <MetricBox size={[slabWidth, slab, slabDepth]} position={[0, slab / 2, 0]} material={[facade, facade, covering, materials.soffit, facade, facade]} castShadow />
        <Parapet width={slabWidth} depth={slabDepth} height={upstand} thickness={edge} bottom={slab} material={facade} materials={materials} />
      </group>
    );
  }
  return (
    <group>
      <MetricBox size={[width - wallThickness * 2 + 0.02, 0.08, depth - wallThickness * 2 + 0.02]} position={[0, 0.04, 0]} material={covering} receiveShadow />
      <Parapet width={width} depth={depth} height={PARAPET_HEIGHT} thickness={wallThickness} bottom={0} material={facade} materials={materials} />
    </group>
  );
};

/** Four walls around a rectangle, capped with an aluminium coping that overhangs both faces. */
const Parapet = ({ width, depth, height, thickness, bottom, material, materials }: { width: number; depth: number; height: number; thickness: number; bottom: number; material: MeshStandardMaterial; materials: SceneMaterials }) => {
  const y = bottom + height / 2;
  const copingY = bottom + height + 0.02;
  return (
    <group>
      {[1, -1].map((side) => (
        <group key={`z${side}`}>
          <MetricBox size={[width, height, thickness]} position={[0, y, side * (depth / 2 - thickness / 2)]} material={material} castShadow />
          <MetricBox size={[width + 0.06, 0.04, thickness + 0.06]} position={[0, copingY, side * (depth / 2 - thickness / 2)]} material={materials.coping} castShadow />
        </group>
      ))}
      {[1, -1].map((side) => (
        <group key={`x${side}`}>
          <MetricBox size={[thickness, height, depth - thickness * 2]} position={[side * (width / 2 - thickness / 2), y, 0]} material={material} castShadow />
          <MetricBox size={[thickness + 0.06, 0.04, depth - thickness * 2]} position={[side * (width / 2 - thickness / 2), copingY, 0]} material={materials.coping} castShadow />
        </group>
      ))}
    </group>
  );
};
