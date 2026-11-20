"use client";

import { roomCenter } from "@/domain/plan/geometry";
import type { Lot, Room } from "@/domain/plan/schema";
import { toScene } from "@/features/viewer-3d/convert";
import { useTiledMaterial, type SceneMaterials } from "@/features/viewer-3d/scene-materials";

/** An open-air structure built on one room of the plan, at the height of its floor. */
interface OutdoorStructureProps {
  room: Room;
  base: number;
  lot: Lot;
  materials: SceneMaterials;
}

/** Swimming pool: raised stone coping and a reflective water surface just above the lawn (the lawn plane is not cut). */
export const Pool = ({ room, base, lot, materials }: OutdoorStructureProps) => {
  const [x, z] = toScene(roomCenter(room), lot);
  const depth = 1.5;
  const coping = 0.35;
  const liner = useTiledMaterial(materials.poolTiles, room.width, room.depth);
  const innerWidth = room.width - coping * 2;
  const innerDepth = room.depth - coping * 2;
  return (
    <group position={[x, base, z]}>
      {/* coping frame */}
      <mesh position={[0, 0.03, -room.depth / 2 + coping / 2]} receiveShadow material={materials.sill}>
        <boxGeometry args={[room.width, 0.06, coping]} />
      </mesh>
      <mesh position={[0, 0.03, room.depth / 2 - coping / 2]} receiveShadow material={materials.sill}>
        <boxGeometry args={[room.width, 0.06, coping]} />
      </mesh>
      <mesh position={[-room.width / 2 + coping / 2, 0.03, 0]} receiveShadow material={materials.sill}>
        <boxGeometry args={[coping, 0.06, innerDepth]} />
      </mesh>
      <mesh position={[room.width / 2 - coping / 2, 0.03, 0]} receiveShadow material={materials.sill}>
        <boxGeometry args={[coping, 0.06, innerDepth]} />
      </mesh>
      {/* basin walls and floor */}
      <mesh position={[0, -depth, 0]} receiveShadow material={liner}>
        <boxGeometry args={[innerWidth, 0.05, innerDepth]} />
      </mesh>
      <mesh position={[0, -depth / 2, -innerDepth / 2 + 0.025]} receiveShadow material={liner}>
        <boxGeometry args={[innerWidth, depth, 0.05]} />
      </mesh>
      <mesh position={[0, -depth / 2, innerDepth / 2 - 0.025]} receiveShadow material={liner}>
        <boxGeometry args={[innerWidth, depth, 0.05]} />
      </mesh>
      <mesh position={[-innerWidth / 2 + 0.025, -depth / 2, 0]} receiveShadow material={liner}>
        <boxGeometry args={[0.05, depth, innerDepth]} />
      </mesh>
      <mesh position={[innerWidth / 2 - 0.025, -depth / 2, 0]} receiveShadow material={liner}>
        <boxGeometry args={[0.05, depth, innerDepth]} />
      </mesh>
      <mesh position={[0, 0.035, 0]} rotation-x={-Math.PI / 2} material={materials.water}>
        <planeGeometry args={[innerWidth, innerDepth]} />
      </mesh>
    </group>
  );
};

/** Carport pergola: wooden posts, beams and slats over the slab. */
export const Pergola = ({ room, base, lot, materials }: OutdoorStructureProps) => {
  const [x, z] = toScene(roomCenter(room), lot);
  const height = 2.6;
  const post = 0.16;
  const inset = 0.25;
  const slats = Math.max(4, Math.floor(room.width / 0.32));
  return (
    <group position={[x, base, z]}>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh
            key={`${sx}${sz}`}
            position={[sx * (room.width / 2 - inset), height / 2, sz * (room.depth / 2 - inset)]}
            castShadow
            material={materials.woodBeam}
          >
            <boxGeometry args={[post, height, post]} />
          </mesh>
        )),
      )}
      <mesh position={[0, height + 0.1, -room.depth / 2 + inset]} castShadow material={materials.woodBeam}>
        <boxGeometry args={[room.width, 0.2, 0.14]} />
      </mesh>
      <mesh position={[0, height + 0.1, room.depth / 2 - inset]} castShadow material={materials.woodBeam}>
        <boxGeometry args={[room.width, 0.2, 0.14]} />
      </mesh>
      {Array.from({ length: slats }, (_, index) => (
        <mesh
          key={index}
          position={[-room.width / 2 + ((index + 0.5) * room.width) / slats, height + 0.26, 0]}
          castShadow
          material={materials.woodBeam}
        >
          <boxGeometry args={[0.06, 0.12, room.depth]} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.34, 0]} material={materials.frame}>
        <boxGeometry args={[room.width - 0.2, 0.03, room.depth - 0.2]} />
      </mesh>
    </group>
  );
};
