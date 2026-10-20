import {
  CanvasTexture,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SRGBColorSpace,
  ShaderChunk,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";

/** Deterministic pseudo-random generator (Park-Miller), so gardens do not change between renders. */
export const createRandom = (seed: number) => {
  let state = Math.floor(Math.abs(seed)) % 2147483647 || 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
};

/**
 * Atlas of leaf clusters drawn on a transparent canvas: twigs carrying
 * pointed leaves with a midrib, in slightly varied greens. Material colors
 * tint it per species.
 */
export const createLeafAtlas = (seed = 7): CanvasTexture => {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  const random = createRandom(seed);
  if (context) {
    context.clearRect(0, 0, size, size);
    for (let cluster = 0; cluster < 9; cluster += 1) {
      const cx = size * (0.2 + random() * 0.6);
      const cy = size * (0.2 + random() * 0.6);
      const leaves = 9 + Math.floor(random() * 6);
      for (let index = 0; index < leaves; index += 1) {
        const angle = random() * Math.PI * 2;
        const distance = size * (0.03 + random() * 0.17);
        const length = size * (0.07 + random() * 0.05);
        const breadth = length * (0.38 + random() * 0.14);
        const x = cx + Math.cos(angle) * distance;
        const y = cy + Math.sin(angle) * distance;
        // Twig toward the cluster center.
        context.strokeStyle = "rgba(70, 60, 35, 0.9)";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(cx, cy);
        context.lineTo(x, y);
        context.stroke();
        const lightness = 32 + random() * 22;
        const hue = 84 + random() * 26;
        context.save();
        context.translate(x, y);
        context.rotate(angle + (random() - 0.5) * 0.9);
        const gradient = context.createLinearGradient(0, -breadth, 0, breadth);
        gradient.addColorStop(0, `hsl(${hue}, 48%, ${lightness + 8}%)`);
        gradient.addColorStop(1, `hsl(${hue + 6}, 52%, ${lightness - 6}%)`);
        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(0, 0);
        context.quadraticCurveTo(length * 0.45, -breadth, length, 0);
        context.quadraticCurveTo(length * 0.45, breadth, 0, 0);
        context.fill();
        context.strokeStyle = `hsla(${hue}, 40%, ${lightness - 14}%, 0.8)`;
        context.lineWidth = 1.2;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(length * 0.92, 0);
        context.stroke();
        context.restore();
      }
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
};

/**
 * Foliage material for instanced leaf cards. Each card carries the normal of
 * the volume it belongs to (attribute `foliageNormal`, in the card's local
 * space), so a crown or a hedge is lit like a mass of leaves rather than a
 * pile of flat quads; back faces keep that normal instead of flipping it.
 */
export const createFoliageMaterial = (atlas: CanvasTexture, color: string): MeshStandardMaterial => {
  const material = new MeshStandardMaterial({ map: atlas, color: new Color(color), alphaTest: 0.42, side: DoubleSide, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 foliageNormal;")
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nobjectNormal = normalize(mix(objectNormal, foliageNormal, 0.82));");
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_begin>", ShaderChunk.normal_fragment_begin.replace("normal *= faceDirection;", ""));
  };
  material.customProgramCacheKey = () => "foliage";
  return material;
};

export interface CardSet {
  matrices: Float32Array;
  normals: Float32Array;
  /** Per-card tint: darker inside and under the volume (cheap self-shadowing), random variation. */
  colors: Float32Array;
  count: number;
}

interface Card {
  position: Vector3;
  /** Outward normal of the volume at the card (world/mesh space). */
  normal: Vector3;
  size: number;
  /** 0 deep inside the volume, 1 on its outer shell. */
  shell: number;
}

/** Packs cards into instance matrices (random spin, facing roughly outward) and local-space volume normals. */
export const packCards = (cards: Card[], random: () => number): CardSet => {
  const matrices = new Float32Array(cards.length * 16);
  const normals = new Float32Array(cards.length * 3);
  const colors = new Float32Array(cards.length * 3);
  const matrix = new Matrix4();
  const rotation = new Quaternion();
  const twist = new Quaternion();
  const scale = new Vector3();
  const local = new Vector3();
  const forward = new Vector3(0, 0, 1);
  cards.forEach((card, index) => {
    // Face the volume normal, then tilt and spin at random so cards cross each other.
    const tilted = card.normal.clone().add(new Vector3(random() - 0.5, random() - 0.5, random() - 0.5).multiplyScalar(1.4)).normalize();
    rotation.setFromUnitVectors(forward, tilted);
    twist.setFromAxisAngle(forward, random() * Math.PI * 2);
    rotation.multiply(twist);
    scale.setScalar(card.size);
    matrix.compose(card.position, rotation, scale);
    matrix.toArray(matrices, index * 16);
    local.copy(card.normal).applyQuaternion(rotation.clone().invert()).normalize();
    local.toArray(normals, index * 3);
    const shade = (0.5 + 0.5 * card.shell) * (0.82 + 0.18 * (card.normal.y + 1) * 0.5) * (0.88 + random() * 0.24);
    colors[index * 3] = shade * (0.96 + random() * 0.08);
    colors[index * 3 + 1] = shade;
    colors[index * 3 + 2] = shade * (0.9 + random() * 0.1);
  });
  return { matrices, normals, colors, count: cards.length };
};

export const cardAttributes = (set: CardSet) => ({
  instanceMatrix: new InstancedBufferAttribute(set.matrices, 16),
  instanceColor: new InstancedBufferAttribute(set.colors, 3),
  foliageNormal: new InstancedBufferAttribute(set.normals, 3),
});

/** Cards on the shell of an ellipsoid (tree crown lobe). */
export const ellipsoidCards = (center: Vector3, radii: Vector3, density: number, size: [number, number], random: () => number): Card[] => {
  const area = 4 * Math.PI * Math.pow((Math.pow(radii.x * radii.y, 1.6) + Math.pow(radii.x * radii.z, 1.6) + Math.pow(radii.y * radii.z, 1.6)) / 3, 1 / 1.6);
  const count = Math.round(area * density);
  const cards: Card[] = [];
  for (let index = 0; index < count; index += 1) {
    const u = random() * 2 - 1;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - u * u);
    const direction = new Vector3(ring * Math.cos(angle), u, ring * Math.sin(angle));
    // Mostly on the shell, some cards deeper to fill the volume.
    const shell = Math.pow(random(), 0.5);
    const position = new Vector3(direction.x * radii.x, direction.y * radii.y, direction.z * radii.z).multiplyScalar(0.62 + shell * 0.4).add(center);
    const normal = new Vector3(direction.x / radii.x, direction.y / radii.y, direction.z / radii.z).normalize();
    cards.push({ position, normal, size: size[0] + random() * (size[1] - size[0]), shell });
  }
  return cards;
};

/** Cards on the outside of a rounded box (clipped hedge), base excluded. */
export const hedgeCards = (center: Vector3, half: Vector3, density: number, size: [number, number], random: () => number): Card[] => {
  const faces: { area: number; pick: () => { position: Vector3; normal: Vector3 } }[] = [
    { area: half.x * half.z * 4, pick: () => ({ position: new Vector3((random() * 2 - 1) * half.x, half.y, (random() * 2 - 1) * half.z), normal: new Vector3(0, 1, 0) }) },
    ...[1, -1].map((side) => ({ area: half.x * half.y * 4, pick: () => ({ position: new Vector3((random() * 2 - 1) * half.x, (random() * 2 - 1) * half.y, side * half.z), normal: new Vector3(0, 0, side) }) })),
    ...[1, -1].map((side) => ({ area: half.z * half.y * 4, pick: () => ({ position: new Vector3(side * half.x, (random() * 2 - 1) * half.y, (random() * 2 - 1) * half.z), normal: new Vector3(side, 0, 0) }) })),
  ];
  const total = faces.reduce((sum, face) => sum + face.area, 0);
  const count = Math.round(total * density);
  const cards: Card[] = [];
  for (let index = 0; index < count; index += 1) {
    let pick = random() * total;
    const face = faces.find((candidate) => (pick -= candidate.area) <= 0) ?? faces[0];
    const { position, normal } = face.pick();
    // Round the edges: blend the face normal with the direction from the center, pull corners in.
    const radial = new Vector3(position.x / half.x, position.y / half.y, position.z / half.z);
    const corner = Math.max(0, radial.length() - 1.15);
    const offset = random();
    position.multiplyScalar(1 - corner * 0.12).addScaledVector(normal, (offset - 0.6) * 0.12).add(center);
    const blended = normal.clone().multiplyScalar(1.4).add(radial.normalize()).normalize();
    cards.push({ position, normal: blended, size: size[0] + random() * (size[1] - size[0]), shell: 0.45 + offset * 0.55 });
  }
  return cards;
};
