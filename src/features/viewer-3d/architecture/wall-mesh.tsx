"use client";

import { useEffect, useMemo } from "react";
import type { MeshStandardMaterial } from "three";
import { isPointInRoom, vecAdd, vecScale } from "@/domain/plan/geometry";
import type { Lot, Room } from "@/domain/plan/schema";
import { buildSolidSegments, type WallSegment } from "@/domain/plan/wall-segments";
import { DoorUnit, WindowUnit, type JoineryStyle } from "@/features/viewer-3d/architecture/openings";
import { toScene } from "@/features/viewer-3d/convert";
import type { SceneMaterials } from "@/features/viewer-3d/scene-materials";
import { buildWallGeometry } from "@/features/viewer-3d/wall-geometry";

const BASEBOARD_HEIGHT = 0.08;
/** Base course of the ground-floor façade (soubassement), in the plinth material. */
const PLINTH_HEIGHT = 0.32;

interface WallMeshProps {
  segment: WallSegment;
  base: number;
  lot: Lot;
  indoorRooms: Room[];
  material: MeshStandardMaterial;
  exteriorMaterial: MeshStandardMaterial;
  materials: SceneMaterials;
  joinery: JoineryStyle;
  isEvening: boolean;
  doorsOpen: boolean;
}

export const WallMesh = ({
  segment,
  base,
  lot,
  indoorRooms,
  material,
  exteriorMaterial,
  materials,
  joinery,
  isEvening,
  doorsOpen,
}: WallMeshProps) => {
  const geometry = useMemo(() => buildWallGeometry(segment, segment.thickness), [segment]);
  const cladding = useMemo(() => (segment.exteriorSide === 0 ? null : buildWallGeometry(segment, 0.012)), [segment]);
  useEffect(
    () => () => {
      geometry.dispose();
      cladding?.dispose();
    },
    [geometry, cladding],
  );
  const interiorSides = useMemo(() => {
    const middle = vecScale(vecAdd(segment.start, segment.end), 0.5);
    const probe = segment.thickness / 2 + 0.1;
    return ([1, -1] as const).filter((side) =>
      indoorRooms.some((room) => isPointInRoom(room, vecAdd(middle, vecScale(segment.normal, side * probe)))),
    );
  }, [indoorRooms, segment]);
  const pieces = useMemo(
    () =>
      buildSolidSegments([segment]).map((piece) => ({
        from: vecLengthAlong(segment, piece.start),
        to: vecLengthAlong(segment, piece.end),
      })),
    [segment],
  );
  const [x, z] = toScene(segment.start, lot);
  const angle = Math.atan2(segment.direction.y, segment.direction.x);
  const half = segment.thickness / 2;
  return (
    <group position={[x, base, z]} rotation-y={-angle}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      {cladding ? (
        <mesh
          geometry={cladding}
          material={exteriorMaterial}
          position-z={segment.exteriorSide * (half + 0.006)}
          castShadow
        />
      ) : null}
      {/* Baseboards on every interior face, interrupted by doors. */}
      {interiorSides.flatMap((side) =>
        pieces.map((piece, index) => (
          <mesh
            key={`${side}-${index}`}
            position={[(piece.from + piece.to) / 2, BASEBOARD_HEIGHT / 2, side * (half + 0.008)]}
            material={materials.trim}
          >
            <boxGeometry args={[piece.to - piece.from, BASEBOARD_HEIGHT, 0.016]} />
          </mesh>
        )),
      )}
      {/* Plinth along the ground-floor façade. */}
      {segment.exteriorSide !== 0 && base < 0.01
        ? pieces.map((piece, index) => (
            <mesh
              key={`plinth-${index}`}
              position={[(piece.from + piece.to) / 2, PLINTH_HEIGHT / 2 - 0.02, segment.exteriorSide * (half + 0.022)]}
              material={materials.plinth}
              castShadow
            >
              <boxGeometry args={[piece.to - piece.from + 0.02, PLINTH_HEIGHT, 0.035]} />
            </mesh>
          ))
        : null}
      {segment.openings.map((opening) =>
        opening.kind === "door" ? (
          <DoorUnit
            key={opening.id}
            opening={opening}
            thickness={segment.thickness}
            exteriorSide={segment.exteriorSide}
            materials={materials}
            style={joinery}
            facade={exteriorMaterial}
            isOpen={doorsOpen}
          />
        ) : (
          <WindowUnit
            key={opening.id}
            opening={opening}
            thickness={segment.thickness}
            exteriorSide={segment.exteriorSide}
            materials={materials}
            style={joinery}
            facade={exteriorMaterial}
            isLit={isEvening && segment.exteriorSide !== 0}
          />
        ),
      )}
    </group>
  );
};

const vecLengthAlong = (segment: WallSegment, point: { x: number; y: number }): number =>
  (point.x - segment.start.x) * segment.direction.x + (point.y - segment.start.y) * segment.direction.y;
