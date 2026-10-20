import { createDefaultMaterials, createDefaultSettings, DEFAULT_EXTERIOR_WALL_THICKNESS, DEFAULT_WALL_THICKNESS } from "../factory";
import { isOutdoorRoom, roomSides } from "../geometry";
import { FURNITURE_PRESETS } from "../labels";
import type { Door, Floor, Furniture, FurnitureType, Lot, Plan, PlanSettings, Room, RoomType, Vec2, Wall, WallSide, Window } from "../schema";

export interface RoomSpec {
  key: string;
  name: string;
  type: RoomType;
  x: number;
  y: number;
  width: number;
  depth: number;
  /** Key of DEFAULT_MATERIAL_SEEDS. */
  floor: string;
  /** Interior wall material (seed key); defaults to white. */
  walls?: string;
  /** Interior material for specific sides (accent wall). */
  wallSides?: Partial<Record<WallSide, string>>;
  /** Exterior sides that get a specific façade material (seed key). */
  facade?: Partial<Record<WallSide, string>>;
}

export interface DoorSpec {
  room: string;
  side: WallSide;
  /** Absolute house-local x (north/south) or y (east/west) of the door center. */
  along: number;
  width?: number;
  height?: number;
  type?: Door["type"];
  swing?: Door["swing"];
}

export interface WindowSpec {
  room: string;
  side: WallSide;
  along: number;
  width?: number;
  height?: number;
  sillHeight?: number;
}

export interface FurnitureSpec {
  key: string;
  type: FurnitureType;
  x: number;
  y: number;
  rotation?: number;
  width?: number;
  depth?: number;
  color?: string;
}

export interface FloorSpec {
  key: string;
  name: string;
  level: number;
  /** Indoor footprint of this level (house-local); rooms outside it are terraces. */
  footprint: { width: number; depth: number };
  rooms: RoomSpec[];
  doors: DoorSpec[];
  windows: WindowSpec[];
  furniture: FurnitureSpec[];
}

export interface HouseTemplateSpec {
  key: string;
  /** Prefix for deterministic ids. */
  idPrefix: string;
  name: string;
  /** Label of the template card (« Contemporaine », « Petite maison »…). */
  shortName: string;
  /** Architectural style shown in the gallery. */
  style: string;
  slug: string | null;
  description: string;
  lot: Lot;
  houseOffset: Vec2;
  wallHeight: number;
  settings: Partial<PlanSettings> & { roofMaterial: string; exteriorMaterial: string };
  floors: FloorSpec[];
}

const isOnFootprintBoundary = (room: Room, side: WallSide, spec: FloorSpec, offset: Vec2): boolean => {
  const maxX = offset.x + spec.footprint.width;
  const maxY = offset.y + spec.footprint.depth;
  switch (side) {
    case "north":
      return Math.abs(room.y - offset.y) < 1e-6;
    case "south":
      return Math.abs(room.y + room.depth - maxY) < 1e-6;
    case "west":
      return Math.abs(room.x - offset.x) < 1e-6;
    case "east":
      return Math.abs(room.x + room.width - maxX) < 1e-6;
  }
};

/** Converts an absolute house-local coordinate along a room side into the wall offset (clockwise walls). */
const offsetAlongSide = (room: Room, side: WallSide, alongLocal: number, offset: Vec2): number => {
  const { start } = roomSides(room)[side];
  switch (side) {
    case "north":
      return alongLocal + offset.x - start.x;
    case "east":
      return alongLocal + offset.y - start.y;
    case "south":
      return start.x - (alongLocal + offset.x);
    case "west":
      return start.y - (alongLocal + offset.y);
  }
};

const buildFloor = (template: HouseTemplateSpec, spec: FloorSpec, materialId: (key: string) => string): Floor => {
  const offset = template.houseOffset;
  const toHouse = (point: Vec2): Vec2 => ({ x: point.x + offset.x, y: point.y + offset.y });
  const id = (kind: string, key: string) => `${template.idPrefix}-${kind}-${key}`;

  const rooms: Room[] = spec.rooms.map((room) => ({
    id: id("room", room.key),
    name: room.name,
    type: room.type,
    ...toHouse({ x: room.x, y: room.y }),
    width: room.width,
    depth: room.depth,
    polygon: null,
    floorMaterialId: materialId(room.floor),
  }));
  const roomByKey = new Map(spec.rooms.map((room, index) => [room.key, rooms[index]]));
  const requireRoom = (key: string): Room => {
    const room = roomByKey.get(key);
    if (!room) throw new Error(`Template "${template.key}": room "${key}" is missing on floor "${spec.key}"`);
    return room;
  };

  const walls: Wall[] = spec.rooms.flatMap((roomSpec, index) => {
    const room = rooms[index];
    if (isOutdoorRoom(room)) return [];
    const sides = roomSides(room);
    return (Object.keys(sides) as WallSide[]).map((side) => {
      const isExterior = isOnFootprintBoundary(room, side, spec, offset);
      const facade = isExterior ? roomSpec.facade?.[side] : undefined;
      return {
        id: id("wall", `${roomSpec.key}-${side}`),
        roomId: room.id,
        side,
        start: sides[side].start,
        end: sides[side].end,
        thickness: isExterior ? DEFAULT_EXTERIOR_WALL_THICKNESS : DEFAULT_WALL_THICKNESS,
        height: template.wallHeight,
        materialId: materialId(facade ?? roomSpec.wallSides?.[side] ?? roomSpec.walls ?? "interior-white"),
      };
    });
  });

  const doors: Door[] = spec.doors.map((door, index) => ({
    id: id("door", `${door.room}-${door.side}-${index}`),
    wallId: id("wall", `${door.room}-${door.side}`),
    offset: offsetAlongSide(requireRoom(door.room), door.side, door.along, offset),
    width: door.width ?? 0.9,
    height: door.height ?? 2.1,
    type: door.type ?? "standard",
    swing: door.swing ?? "left",
  }));

  const windows: Window[] = spec.windows.map((window, index) => ({
    id: id("window", `${window.room}-${window.side}-${index}`),
    wallId: id("wall", `${window.room}-${window.side}`),
    offset: offsetAlongSide(requireRoom(window.room), window.side, window.along, offset),
    width: window.width ?? 1.2,
    height: window.height ?? 1.2,
    sillHeight: window.sillHeight ?? 0.9,
  }));

  const furniture: Furniture[] = spec.furniture.map((item) => {
    const preset = FURNITURE_PRESETS[item.type];
    return {
      id: id("furniture", `${spec.key}-${item.key}`),
      type: item.type,
      ...toHouse({ x: item.x, y: item.y }),
      rotation: item.rotation ?? 0,
      width: item.width ?? preset.width,
      depth: item.depth ?? preset.depth,
      height: preset.height,
      color: item.color ?? preset.color,
    };
  });

  return { id: id("floor", spec.key), name: spec.name, level: spec.level, height: template.wallHeight, rooms, walls, doors, windows, furniture, annotations: [] };
};

/** Builds a complete, valid plan from a template specification (deterministic ids). */
export const buildPlanFromSpec = (template: HouseTemplateSpec): Plan => {
  const materialId = (key: string) => `${template.idPrefix}-material-${key}`;
  const materials = createDefaultMaterials(materialId);
  const { roofMaterial, exteriorMaterial, ...settingsOverrides } = template.settings;
  const settings: PlanSettings = {
    ...createDefaultSettings(materials, template.wallHeight),
    ...settingsOverrides,
    roofMaterialId: materialId(roofMaterial),
    exteriorMaterialId: materialId(exteriorMaterial),
  };
  return {
    id: `${template.idPrefix}-project-${template.key}`,
    name: template.name,
    description: template.description,
    slug: template.slug,
    lot: template.lot,
    settings,
    materials,
    floors: template.floors.map((floor) => buildFloor(template, floor, materialId)),
  };
};
