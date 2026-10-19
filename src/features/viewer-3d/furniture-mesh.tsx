"use client";

import { RoundedBox } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { Color, type MeshStandardMaterial } from "three";
import type { Furniture, Lot } from "@/domain/plan/schema";
import { toScene } from "@/features/viewer-3d/convert";
import { ScannedModel } from "@/features/viewer-3d/scanned-model";
import { createPhotoMaterial, type SceneMaterials } from "@/features/viewer-3d/scene-materials";

interface FurnitureMeshProps {
  item: Furniture;
  base: number;
  lot: Lot;
  materials: SceneMaterials;
  isEvening?: boolean;
  /** Furniture standing in a terrace or carport keeps weather-proof primitives. */
  isOutdoor?: boolean;
}

interface Soft {
  size: [number, number, number];
  position: [number, number, number];
  material: MeshStandardMaterial;
  radius?: number;
}

/** Upholstered volume: rounded edges and a real linen texture. */
const Soft = ({ size, position, material, radius = 0.06 }: Soft) => (
  <RoundedBox args={size} radius={Math.min(radius, size[0] / 2.2, size[1] / 2.2, size[2] / 2.2)} smoothness={4} position={position} material={material} castShadow receiveShadow />
);

const shade = (hex: string, factor: number): string => {
  const color = new Color(hex);
  color.multiplyScalar(factor);
  return `#${color.getHexString()}`;
};

interface BlockProps {
  size: [number, number, number];
  position: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  rotation?: [number, number, number];
}

const Block = ({ size, position, color, roughness = 0.75, metalness = 0, rotation }: BlockProps) => (
  <mesh position={position} rotation={rotation} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />
  </mesh>
);

interface CylinderProps {
  radius: number | [number, number];
  height: number;
  position: [number, number, number];
  color: string;
  roughness?: number;
  metalness?: number;
  segments?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

const Cylinder = ({ radius, height, position, color, roughness = 0.7, metalness = 0, segments = 20, emissive, emissiveIntensity = 0 }: CylinderProps) => {
  const [top, bottom] = Array.isArray(radius) ? radius : [radius, radius];
  return (
    <mesh position={position} castShadow receiveShadow>
      <cylinderGeometry args={[top, bottom, height, segments]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} emissive={emissive ?? "#000000"} emissiveIntensity={emissiveIntensity} />
    </mesh>
  );
};

const Legs = ({ w, d, height, inset = 0.08, size = 0.05, color }: { w: number; d: number; height: number; inset?: number; size?: number; color: string }) => (
  <>
    {[-1, 1].flatMap((sx) =>
      [-1, 1].map((sz) => <Block key={`${sx}${sz}`} size={[size, height, size]} position={[sx * (w / 2 - inset), height / 2, sz * (d / 2 - inset)]} color={color} />),
    )}
  </>
);

interface FurnitureBlocksProps {
  item: Furniture;
  isEvening: boolean;
  isOutdoor: boolean;
  fabric: MeshStandardMaterial | null;
  pillow: MeshStandardMaterial | null;
}

/**
 * Indoor seats, tables, plants and the TV cabinet use scanned models sized to
 * the plan; upholstery uses rounded volumes in real linen; the rest is built
 * from proportioned primitives.
 */
const FurnitureBlocks = ({ item, isEvening, isOutdoor, fabric, pillow }: FurnitureBlocksProps) => {
  const { width: w, depth: d, height: h, color } = item;
  const dark = shade(color, 0.65);
  const light = shade(color, 1.25);
  if (!isOutdoor) {
    switch (item.type) {
      case "armchair":
        return <ScannedModel model="armchair" width={w} depth={d} height={h} />;
      case "chair":
        return <ScannedModel model="diningChair" width={w} depth={d} height={h} />;
      case "table":
        return <ScannedModel model="table" width={w} depth={d} height={h} fit="stretch" />;
      case "stool":
        return <ScannedModel model="barStool" width={w} depth={d} height={h} />;
    }
  }
  switch (item.type) {
    case "coffee_table":
      return <ScannedModel model="coffeeTable" width={w} depth={d} height={h} fit="stretch" rotateY={Math.PI / 2} />;
    case "plant":
      return <ScannedModel model={h > 1.1 ? "plantTall" : "plantWide"} width={w * 1.4} depth={d * 1.4} height={h} />;
    case "bed": {
      if (!fabric || !pillow) return null;
      const headboard = 1.0;
      return (
        <>
          <Block size={[w, 0.24, d]} position={[0, 0.2, 0]} color={dark} roughness={0.7} />
          <Legs w={w} d={d} height={0.08} inset={0.06} size={0.06} color={dark} />
          <Soft size={[w - 0.04, 0.24, d - 0.06]} position={[0, 0.44, 0.02]} material={pillow} radius={0.08} />
          <Soft size={[w + 0.02, 0.07, d * 0.66]} position={[0, 0.58, d * 0.17]} material={fabric} radius={0.03} />
          <Soft size={[w * 0.42, 0.14, 0.42]} position={[-w * 0.23, 0.62, -d / 2 + 0.34]} material={pillow} radius={0.06} />
          <Soft size={[w * 0.42, 0.14, 0.42]} position={[w * 0.23, 0.62, -d / 2 + 0.34]} material={pillow} radius={0.06} />
          <Soft size={[w + 0.1, headboard, 0.1]} position={[0, headboard / 2, -d / 2 - 0.03]} material={fabric} radius={0.04} />
        </>
      );
    }
    case "sofa":
    case "armchair": {
      if (!fabric) return null;
      const arm = 0.2;
      const seatHeight = 0.42;
      const cushions = item.type === "sofa" ? Math.max(2, Math.round(w / 0.9)) : 1;
      const cushionWidth = (w - arm * 2 - 0.02 * (cushions - 1)) / cushions;
      return (
        <>
          <Soft size={[w, 0.2, d]} position={[0, 0.2, 0]} material={fabric} radius={0.04} />
          <Legs w={w} d={d} height={0.1} inset={0.1} size={0.04} color="#2b2b2b" />
          {Array.from({ length: cushions }, (_, index) => (
            <Soft
              key={index}
              size={[cushionWidth, 0.17, d - 0.26]}
              position={[-w / 2 + arm + cushionWidth / 2 + index * (cushionWidth + 0.02), seatHeight - 0.03, 0.09]}
              material={fabric}
              radius={0.07}
            />
          ))}
          {Array.from({ length: cushions }, (_, index) => (
            <Soft
              key={`back-${index}`}
              size={[cushionWidth, 0.46, 0.2]}
              position={[-w / 2 + arm + cushionWidth / 2 + index * (cushionWidth + 0.02), seatHeight + 0.24, -d / 2 + 0.16]}
              material={fabric}
              radius={0.08}
            />
          ))}
          <Soft size={[w, 0.5, 0.14]} position={[0, 0.5, -d / 2 + 0.07]} material={fabric} radius={0.05} />
          <Soft size={[arm, 0.38, d]} position={[-w / 2 + arm / 2, 0.47, 0]} material={fabric} radius={0.07} />
          <Soft size={[arm, 0.38, d]} position={[w / 2 - arm / 2, 0.47, 0]} material={fabric} radius={0.07} />
        </>
      );
    }
    case "table":
    case "desk":
      return (
        <>
          <Block size={[w, 0.04, d]} position={[0, h - 0.02, 0]} color={color} roughness={0.5} />
          <Block size={[w - 0.1, 0.06, d - 0.1]} position={[0, h - 0.07, 0]} color={dark} />
          <Legs w={w} d={d} height={h - 0.1} inset={0.07} size={0.05} color={dark} />
          {item.type === "desk" ? <Block size={[Math.min(0.42, w / 3), h - 0.2, d - 0.08]} position={[w / 2 - Math.min(0.42, w / 3) / 2 - 0.04, (h - 0.2) / 2, 0]} color={dark} /> : null}
        </>
      );
    case "chair":
      return (
        <>
          <Block size={[w, 0.05, d]} position={[0, 0.45, 0]} color={color} roughness={0.6} />
          <Block size={[w, 0.04, d]} position={[0, 0.49, 0]} color={light} roughness={0.95} />
          <Block size={[w * 0.9, 0.42, 0.04]} position={[0, 0.72, -d / 2 + 0.03]} color={color} roughness={0.6} />
          <Legs w={w} d={d} height={0.45} inset={0.04} size={0.035} color={dark} />
        </>
      );
    case "wardrobe": {
      const doors = Math.max(1, Math.round(w / 0.5));
      const doorWidth = w / doors;
      return (
        <>
          <Block size={[w, h, d]} position={[0, h / 2, 0]} color={color} roughness={0.6} />
          <Block size={[w, 0.06, d + 0.02]} position={[0, h - 0.03, 0]} color={dark} />
          <Block size={[w, 0.08, d + 0.01]} position={[0, 0.04, 0]} color={dark} />
          {Array.from({ length: doors }, (_, index) => (
            <group key={index} position={[-w / 2 + doorWidth * (index + 0.5), h / 2, d / 2 + 0.006]}>
              <Block size={[doorWidth - 0.02, h - 0.16, 0.012]} position={[0, 0, 0]} color={light} roughness={0.5} />
              <Block size={[0.02, 0.18, 0.025]} position={[index % 2 === 0 ? doorWidth / 2 - 0.06 : -doorWidth / 2 + 0.06, 0, 0.018]} color="#b8b8b8" metalness={0.6} roughness={0.3} />
            </group>
          ))}
        </>
      );
    }
    case "kitchen": {
      const units = Math.max(1, Math.round(w / 0.6));
      const unitWidth = w / units;
      return (
        <>
          <Block size={[w, h - 0.1, d - 0.02]} position={[0, (h - 0.1) / 2 + 0.06, 0]} color={color} roughness={0.6} />
          <Block size={[w, 0.06, d - 0.06]} position={[0, 0.03, 0]} color="#2f2f2f" />
          <Block size={[w + 0.03, 0.04, d + 0.03]} position={[0, h - 0.02, 0]} color="#4b4f55" roughness={0.35} />
          {Array.from({ length: units }, (_, index) => (
            <group key={index} position={[-w / 2 + unitWidth * (index + 0.5), (h - 0.1) / 2 + 0.06, d / 2 + 0.005]}>
              <Block size={[unitWidth - 0.02, h - 0.2, 0.01]} position={[0, 0, 0]} color={light} roughness={0.5} />
              <Block size={[0.12, 0.015, 0.02]} position={[0, (h - 0.2) / 2 - 0.06, 0.012]} color="#9a9a9a" metalness={0.6} roughness={0.3} />
            </group>
          ))}
          {w >= 1.8 ? (
            <>
              <Block size={[0.55, 0.012, d * 0.6]} position={[-w / 4, h + 0.006, 0]} color="#c7ccd1" metalness={0.7} roughness={0.25} />
              <Block size={[0.45, 0.012, d * 0.6]} position={[w / 4, h + 0.006, 0]} color="#1c1c1c" roughness={0.3} />
              <Cylinder radius={0.012} height={0.3} position={[-w / 4 + 0.2, h + 0.15, -d * 0.3]} color="#b0b4b8" metalness={0.8} roughness={0.2} segments={10} />
            </>
          ) : null}
        </>
      );
    }
    case "bathtub":
      return (
        <>
          <Block size={[w, h, d]} position={[0, h / 2, 0]} color={color} roughness={0.25} />
          <Block size={[w - 0.14, 0.05, d - 0.14]} position={[0, h - 0.025, 0]} color="#dbe9f2" roughness={0.1} />
          <Cylinder radius={0.015} height={0.25} position={[0, h + 0.12, -d / 2 + 0.08]} color="#b0b4b8" metalness={0.8} roughness={0.2} segments={10} />
        </>
      );
    case "shower":
      return (
        <>
          <Block size={[w, 0.06, d]} position={[0, 0.03, 0]} color="#e8e8e6" roughness={0.3} />
          <mesh position={[-w / 2 + 0.006, h / 2, 0]}>
            <boxGeometry args={[0.012, h - 0.06, d]} />
            <meshStandardMaterial color="#cfe3ef" transparent opacity={0.35} roughness={0.05} metalness={0.3} />
          </mesh>
          <mesh position={[0, h / 2, d / 2 - 0.006]}>
            <boxGeometry args={[w, h - 0.06, 0.012]} />
            <meshStandardMaterial color="#cfe3ef" transparent opacity={0.35} roughness={0.05} metalness={0.3} />
          </mesh>
          <Cylinder radius={0.014} height={h - 0.2} position={[w / 2 - 0.08, (h - 0.2) / 2 + 0.06, -d / 2 + 0.08]} color="#b0b4b8" metalness={0.8} roughness={0.2} segments={10} />
          <Cylinder radius={0.09} height={0.02} position={[w / 2 - 0.2, h - 0.15, -d / 2 + 0.2]} color="#b0b4b8" metalness={0.8} roughness={0.2} />
        </>
      );
    case "washbasin":
      return (
        <>
          <Block size={[w, h - 0.12, d]} position={[0, (h - 0.12) / 2 + 0.05, 0]} color="#8a7560" roughness={0.6} />
          <Block size={[w, 0.03, d + 0.02]} position={[0, h - 0.015, 0]} color="#f3f2ee" roughness={0.25} />
          <Block size={[w * 0.45, 0.14, d * 0.6]} position={[0, h - 0.01, 0]} color="#ffffff" roughness={0.2} />
          <Cylinder radius={0.012} height={0.18} position={[0, h + 0.09, -d / 2 + 0.08]} color="#b0b4b8" metalness={0.8} roughness={0.2} segments={10} />
          <Block size={[w * 0.8, 0.7, 0.02]} position={[0, h + 0.55, -d / 2 - 0.01]} color="#9fb7c9" metalness={0.9} roughness={0.05} />
        </>
      );
    case "toilet":
      return (
        <>
          <Block size={[w, 0.38, d * 0.62]} position={[0, 0.19, d * 0.17]} color={color} roughness={0.25} />
          <Block size={[w, 0.36, 0.18]} position={[0, 0.58, -d / 2 + 0.09]} color={color} roughness={0.25} />
          <Block size={[w - 0.04, 0.04, d * 0.58]} position={[0, 0.4, d * 0.17]} color="#eceef0" roughness={0.3} />
          <Block size={[0.08, 0.02, 0.02]} position={[w / 2 - 0.08, 0.77, -d / 2 + 0.02]} color="#b0b4b8" metalness={0.7} roughness={0.3} />
        </>
      );
    case "stairs": {
      const steps = 13;
      const stepDepth = d / steps;
      const stepHeight = h / steps;
      return (
        <>
          {Array.from({ length: steps }, (_, index) => (
            <Block key={index} size={[w, stepHeight * (index + 1), stepDepth]} position={[0, (stepHeight * (index + 1)) / 2, d / 2 - stepDepth * (index + 0.5)]} color={index % 2 === 0 ? color : light} roughness={0.6} />
          ))}
          <Block size={[0.03, 0.9, d]} position={[w / 2 + 0.015, h / 2 + 0.35, 0]} color="#4b4f55" metalness={0.5} roughness={0.4} />
        </>
      );
    }
    case "tv": {
      // Front of the TV (screen side) is local -z, like the artwork.
      const screenWidth = Math.min(1.45, w * 0.7);
      const screenHeight = screenWidth * 0.5625;
      return (
        <>
          <ScannedModel model="tvCabinet" width={w} depth={d} height={0.5} fit="stretch" rotateY={Math.PI} />
          <Block size={[screenWidth + 0.02, screenHeight + 0.02, 0.03]} position={[0, 0.58 + screenHeight / 2, d / 2 - 0.08]} color="#0b0d10" roughness={0.25} />
          <mesh position={[0, 0.58 + screenHeight / 2, d / 2 - 0.096]}>
            <boxGeometry args={[screenWidth - 0.02, screenHeight - 0.02, 0.002]} />
            <meshStandardMaterial color="#0d1522" roughness={0.12} metalness={0.5} emissive="#1f3f66" emissiveIntensity={isEvening ? 0.7 : 0} />
          </mesh>
          <ScannedModel model="vase" width={0.16} depth={0.16} height={0.32} />
        </>
      );
    }
    case "plant":
      return (
        <>
          <Cylinder radius={[w * 0.32, w * 0.26]} height={0.36} position={[0, 0.18, 0]} color="#8a6a4a" roughness={0.85} />
          <Cylinder radius={0.02} height={h * 0.45} position={[0, 0.36 + h * 0.22, 0]} color="#4f3a28" segments={8} />
          <mesh position={[0, h * 0.7, 0]} castShadow>
            <sphereGeometry args={[w * 0.72, 14, 12]} />
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
          <mesh position={[w * 0.32, h * 0.85, -w * 0.2]} castShadow>
            <sphereGeometry args={[w * 0.5, 12, 10]} />
            <meshStandardMaterial color={light} roughness={0.9} />
          </mesh>
          <mesh position={[-w * 0.35, h * 0.8, w * 0.25]} castShadow>
            <sphereGeometry args={[w * 0.42, 12, 10]} />
            <meshStandardMaterial color={shade(color, 0.85)} roughness={0.9} />
          </mesh>
        </>
      );
    case "lamp":
      return (
        <>
          <Cylinder radius={w * 0.5} height={0.03} position={[0, 0.015, 0]} color="#2b2b2b" metalness={0.5} roughness={0.4} />
          <Cylinder radius={0.014} height={h - 0.4} position={[0, (h - 0.4) / 2 + 0.03, 0]} color="#8a8a8a" metalness={0.7} roughness={0.3} segments={10} />
          <Cylinder radius={[w * 0.42, w * 0.5]} height={0.34} position={[0, h - 0.2, 0]} color={color} roughness={0.9} emissive="#ffd9a8" emissiveIntensity={isEvening ? 0.9 : 0.05} />
        </>
      );
    case "rug":
      return (
        <mesh position={[0, 0.008, 0]} receiveShadow>
          <boxGeometry args={[w, 0.016, d]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      );
    case "artwork": {
      // Hung on the wall behind the item (local +z); the canvas faces local -z, like the television screen.
      const centerY = 1.45;
      return (
        <>
          <Block size={[w, h, 0.035]} position={[0, centerY, d / 2 - 0.02]} color="#15181d" roughness={0.5} />
          <Block size={[w - 0.08, h - 0.08, 0.012]} position={[0, centerY, d / 2 - 0.045]} color={color} roughness={0.8} />
          <Block size={[(w - 0.08) * 0.55, (h - 0.08) * 0.35, 0.006]} position={[-(w - 0.08) * 0.12, centerY + (h - 0.08) * 0.12, d / 2 - 0.054]} color={light} roughness={0.8} />
          <Block size={[(w - 0.08) * 0.3, (h - 0.08) * 0.5, 0.006]} position={[(w - 0.08) * 0.25, centerY - (h - 0.08) * 0.1, d / 2 - 0.054]} color={dark} roughness={0.8} />
        </>
      );
    }
    case "stool":
      return (
        <>
          <Cylinder radius={w * 0.45} height={0.03} position={[0, 0.015, 0]} color={color} metalness={0.5} roughness={0.4} />
          <Cylinder radius={0.02} height={h - 0.08} position={[0, (h - 0.08) / 2 + 0.03, 0]} color="#8a8a8a" metalness={0.8} roughness={0.25} segments={10} />
          <Cylinder radius={w * 0.5} height={0.06} position={[0, h - 0.03, 0]} color={color} roughness={0.6} />
          <Cylinder radius={w * 0.46} height={0.03} position={[0, h + 0.015, 0]} color={light} roughness={0.9} />
        </>
      );
    case "umbrella":
      return (
        <>
          <Cylinder radius={0.25} height={0.06} position={[0, 0.03, 0]} color="#3a3d42" roughness={0.6} />
          <Cylinder radius={0.025} height={h - 0.5} position={[0, (h - 0.5) / 2 + 0.06, 0]} color="#d6d3d1" metalness={0.6} roughness={0.3} segments={10} />
          <mesh position={[0, h - 0.28, 0]} castShadow>
            <coneGeometry args={[w / 2, 0.5, 8, 1, true]} />
            <meshStandardMaterial color={color} roughness={0.9} side={2} />
          </mesh>
        </>
      );
  }
};

const UPHOLSTERED = new Set<Furniture["type"]>(["sofa", "bed", "armchair"]);

export const FurnitureMesh = ({ item, base, lot, materials, isEvening = false, isOutdoor = false }: FurnitureMeshProps) => {
  const [x, z] = toScene({ x: item.x, y: item.y }, lot);
  const needsFabric = UPHOLSTERED.has(item.type);
  const fabric = useMemo(() => (needsFabric ? createPhotoMaterial(materials.photos.linen, item.color, 1) : null), [needsFabric, materials.photos.linen, item.color]);
  const pillow = useMemo(() => (item.type === "bed" ? createPhotoMaterial(materials.photos.linen, "#f3f0ea", 1) : null), [item.type, materials.photos.linen]);
  useEffect(
    () => () => {
      fabric?.dispose();
      pillow?.dispose();
    },
    [fabric, pillow],
  );
  return (
    <group position={[x, base, z]} rotation-y={(-item.rotation * Math.PI) / 180}>
      <FurnitureBlocks item={item} isEvening={isEvening} isOutdoor={isOutdoor} fabric={fabric} pillow={pillow} />
    </group>
  );
};
