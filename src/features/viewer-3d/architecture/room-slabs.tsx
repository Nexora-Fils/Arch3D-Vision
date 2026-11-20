"use client";

import { useMemo } from "react";
import type { MeshStandardMaterial } from "three";
import { LEVEL_SLAB_THICKNESS, type Bounds } from "@/domain/plan/geometry";
import type { Lot, Room } from "@/domain/plan/schema";
import { subtractRects } from "@/domain/plan/stairs";
import { toScene } from "@/features/viewer-3d/convert";
import { ScannedModel } from "@/features/viewer-3d/scanned-model";
import { useTiledMaterial, type SceneMaterials } from "@/features/viewer-3d/scene-materials";

const SLAB_THICKNESS = 0.1;

interface RoomSlabsProps {
  room: Room;
  floorHoles: Bounds[];
  ceilingHoles: Bounds[];
  base: number;
  lot: Lot;
  height: number;
  floorMaterial: MeshStandardMaterial;
  ceilingMaterial: MeshStandardMaterial | null;
  materials: SceneMaterials;
  isEvening: boolean;
  lightsEnabled: boolean;
  isOutdoor: boolean;
}

export const RoomSlabs = ({
  room,
  base,
  lot,
  height,
  floorMaterial,
  ceilingMaterial,
  materials,
  isEvening,
  lightsEnabled,
  isOutdoor,
  floorHoles,
  ceilingHoles,
}: RoomSlabsProps) => {
  const bounds = useMemo<Bounds>(
    () => ({ minX: room.x, minY: room.y, maxX: room.x + room.width, maxY: room.y + room.depth }),
    [room.x, room.y, room.width, room.depth],
  );
  const floorPieces = useMemo(() => subtractRects(bounds, floorHoles), [bounds, floorHoles]);
  const ceilingPieces = useMemo(() => subtractRects(bounds, ceilingHoles), [bounds, ceilingHoles]);
  // The pendant and its light hang over the largest part of the room that is not a stairwell.
  const lampSpot = useMemo(() => {
    const pieces = subtractRects(bounds, [...floorHoles, ...ceilingHoles]);
    const largest = pieces.reduce<Bounds | null>((best, piece) => {
      const area = (piece.maxX - piece.minX) * (piece.maxY - piece.minY);
      return !best || area > (best.maxX - best.minX) * (best.maxY - best.minY) ? piece : best;
    }, null);
    if (!largest) return null;
    return {
      x: (largest.minX + largest.maxX) / 2,
      y: (largest.minY + largest.maxY) / 2,
      area: (largest.maxX - largest.minX) * (largest.maxY - largest.minY),
    };
  }, [bounds, floorHoles, ceilingHoles]);
  const isGroundDeck = isOutdoor && base < 0.01;
  const hasPendant = ceilingMaterial !== null && lampSpot !== null && lampSpot.area >= 3;
  const [lampX, lampZ] = lampSpot ? toScene(lampSpot, lot) : [0, 0];
  return (
    <group>
      {floorPieces.map((piece, index) => (
        <SlabPiece
          key={`floor-${index}`}
          piece={piece}
          room={bounds}
          lot={lot}
          bottom={base - SLAB_THICKNESS - (isGroundDeck ? 0.02 : 0)}
          thickness={isGroundDeck ? 0.12 : SLAB_THICKNESS}
          edges={isGroundDeck ? materials.kerb : undefined}
          material={floorMaterial}
          castShadow={isOutdoor}
        />
      ))}
      {ceilingMaterial
        ? ceilingPieces.map((piece, index) => (
            <SlabPiece
              key={`ceiling-${index}`}
              piece={piece}
              room={bounds}
              lot={lot}
              bottom={base + height}
              thickness={LEVEL_SLAB_THICKNESS - 0.02}
              material={ceilingMaterial}
              underside={isEvening ? materials.ceiling : materials.ceilingDaylight}
            />
          ))
        : null}
      {hasPendant ? (
        <group position={[lampX, base + height - 0.75, lampZ]}>
          <ScannedModel model="ceilingLamp" width={0.43} depth={0.43} height={0.75} />
          {isEvening ? (
            <mesh position-y={0.12} material={materials.lampLit}>
              <sphereGeometry args={[0.09, 16, 12]} />
            </mesh>
          ) : null}
        </group>
      ) : null}
      {lightsEnabled && lampSpot ? (
        <pointLight
          position={[lampX, base + height - 0.6, lampZ]}
          color="#ffe2c2"
          intensity={10}
          distance={9}
          decay={2}
        />
      ) : null}
    </group>
  );
};

interface SlabPieceProps {
  piece: Bounds;
  /** Whole room, so textures stay continuous across the pieces around a stairwell. */
  room: Bounds;
  lot: Lot;
  bottom: number;
  thickness: number;
  material: MeshStandardMaterial;
  /** Material of the underside (painted ceiling); defaults to `material`. */
  underside?: MeshStandardMaterial;
  /** Material of the four sides (concrete edging of ground-level terraces); defaults to `material`. */
  edges?: MeshStandardMaterial;
  castShadow?: boolean;
}

const SlabPiece = ({
  piece,
  room,
  lot,
  bottom,
  thickness,
  material,
  underside,
  edges,
  castShadow = false,
}: SlabPieceProps) => {
  const width = piece.maxX - piece.minX;
  const depth = piece.maxY - piece.minY;
  // Box top faces map U along +x and V towards -y: offset by the piece's corner within the room.
  const offsetX = piece.minX - room.minX;
  const offsetY = room.maxY - piece.maxY;
  const top = useTiledMaterial(material, width, depth, offsetX, offsetY);
  const below = useTiledMaterial(underside ?? material, width, depth, offsetX, offsetY);
  const [x, z] = toScene({ x: (piece.minX + piece.maxX) / 2, y: (piece.minY + piece.maxY) / 2 }, lot);
  return (
    // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
    <mesh
      position={[x, bottom + thickness / 2, z]}
      receiveShadow
      castShadow={castShadow}
      material={[edges ?? top, edges ?? top, top, below, edges ?? top, edges ?? top]}
    >
      <boxGeometry args={[width, thickness, depth]} />
    </mesh>
  );
};
