import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { statsFromRooms, type PlanPreview, type PlanStats } from "@/domain/plan/preview";
import {
  annotationSchema,
  DOOR_TYPES,
  FURNITURE_TYPES,
  MATERIAL_KINDS,
  planSchema,
  ROOM_TYPES,
  WALL_SIDES,
  type Door,
  type Floor,
  type Furniture,
  type Material,
  type Plan,
  type Room,
  type Wall,
  type Window,
} from "@/domain/plan/schema";

export interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  lotWidth: number;
  lotDepth: number;
  floorCount: number;
  stats: PlanStats;
  /** Ground floor, for the SVG fallback thumbnail. */
  preview: PlanPreview;
  /** JPEG data URL captured from the 3D view, when available. */
  thumbnail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatabaseStatus {
  version: string;
  projectCount: number;
  roomCount: number;
}

export class ProjectNotFoundError extends Error {
  constructor(id: string) {
    super(`Projet introuvable : ${id}`);
    this.name = "ProjectNotFoundError";
  }
}

const projectWithPlan = {
  include: {
    materials: { orderBy: { name: "asc" } },
    floors: {
      orderBy: { level: "asc" },
      include: {
        rooms: { orderBy: { sortOrder: "asc" } },
        walls: { include: { doors: true, windows: true } },
        furniture: true,
      },
    },
  },
} satisfies Prisma.ProjectDefaultArgs;

type ProjectWithPlan = Prisma.ProjectGetPayload<typeof projectWithPlan>;

const asEnum = <T extends readonly string[]>(values: T, value: string, fallback: T[number]): T[number] =>
  (values as readonly string[]).includes(value) ? (value as T[number]) : fallback;

const toMaterial = (row: ProjectWithPlan["materials"][number]): Material => ({
  id: row.id,
  name: row.name,
  kind: asEnum(MATERIAL_KINDS, row.kind, "wall"),
  color: row.color,
  roughness: row.roughness,
});

const toRoom = (row: ProjectWithPlan["floors"][number]["rooms"][number]): Room => ({
  id: row.id,
  name: row.name,
  type: asEnum(ROOM_TYPES, row.type, "other"),
  x: row.x,
  y: row.y,
  width: row.width,
  depth: row.depth,
  polygon: null,
  floorMaterialId: row.floorMaterialId,
});

type WallRow = ProjectWithPlan["floors"][number]["walls"][number];

const toWall = (row: WallRow): Wall => ({
  id: row.id,
  roomId: row.roomId,
  side: row.side ? asEnum(WALL_SIDES, row.side, "north") : null,
  start: { x: row.x1, y: row.y1 },
  end: { x: row.x2, y: row.y2 },
  thickness: row.thickness,
  height: row.height,
  materialId: row.materialId,
});

const toDoor = (row: WallRow["doors"][number]): Door => ({
  id: row.id,
  wallId: row.wallId,
  offset: row.offset,
  width: row.width,
  height: row.height,
  type: asEnum(DOOR_TYPES, row.type, "standard"),
  swing: row.swing === "right" ? "right" : "left",
});

const toWindow = (row: WallRow["windows"][number]): Window => ({
  id: row.id,
  wallId: row.wallId,
  offset: row.offset,
  width: row.width,
  height: row.height,
  sillHeight: row.sillHeight,
});

const toFurniture = (row: ProjectWithPlan["floors"][number]["furniture"][number]): Furniture => ({
  id: row.id,
  type: asEnum(FURNITURE_TYPES, row.type, "table"),
  x: row.x,
  y: row.y,
  rotation: row.rotation,
  width: row.width,
  depth: row.depth,
  height: row.height,
  color: row.color,
});

const toFloor = (row: ProjectWithPlan["floors"][number]): Floor => ({
  id: row.id,
  name: row.name,
  level: row.level,
  height: row.height,
  rooms: row.rooms.map(toRoom),
  walls: row.walls.map(toWall),
  doors: row.walls.flatMap((wall) => wall.doors.map(toDoor)),
  windows: row.walls.flatMap((wall) => wall.windows.map(toWindow)),
  furniture: row.furniture.map(toFurniture),
  annotations: annotationSchema.array().catch([]).parse(row.annotations),
});

const toPlan = (row: ProjectWithPlan): Plan => {
  const candidate = {
    id: row.id,
    name: row.name,
    description: row.description,
    slug: row.slug,
    lot: { width: row.lotWidth, depth: row.lotDepth },
    settings: row.settings,
    materials: row.materials.map(toMaterial),
    floors: row.floors.map(toFloor),
  };
  const parsed = planSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(`Données du projet ${row.id} invalides : ${parsed.error.message}`);
  }
  return parsed.data;
};

const floorCreateInput = (floor: Floor): Prisma.FloorCreateWithoutProjectInput => {
  const doorsByWall = new Map<string, Door[]>();
  for (const door of floor.doors) {
    doorsByWall.set(door.wallId, [...(doorsByWall.get(door.wallId) ?? []), door]);
  }
  const windowsByWall = new Map<string, Window[]>();
  for (const window of floor.windows) {
    windowsByWall.set(window.wallId, [...(windowsByWall.get(window.wallId) ?? []), window]);
  }
  return {
    id: floor.id,
    name: floor.name,
    level: floor.level,
    height: floor.height,
    annotations: floor.annotations,
    rooms: {
      create: floor.rooms.map((room, index) => ({
        id: room.id,
        name: room.name,
        type: room.type,
        x: room.x,
        y: room.y,
        width: room.width,
        depth: room.depth,
        polygon: room.polygon ?? Prisma.JsonNull,
        floorMaterialId: room.floorMaterialId,
        sortOrder: index,
      })),
    },
    walls: {
      create: floor.walls.map((wall) => ({
        id: wall.id,
        roomId: wall.roomId,
        side: wall.side,
        x1: wall.start.x,
        y1: wall.start.y,
        x2: wall.end.x,
        y2: wall.end.y,
        thickness: wall.thickness,
        height: wall.height,
        materialId: wall.materialId,
        doors: {
          create: (doorsByWall.get(wall.id) ?? []).map((door) => ({
            id: door.id,
            offset: door.offset,
            width: door.width,
            height: door.height,
            type: door.type,
            swing: door.swing,
          })),
        },
        windows: {
          create: (windowsByWall.get(wall.id) ?? []).map((window) => ({
            id: window.id,
            offset: window.offset,
            width: window.width,
            height: window.height,
            sillHeight: window.sillHeight,
          })),
        },
      })),
    },
    furniture: {
      create: floor.furniture.map((item) => ({
        id: item.id,
        type: item.type,
        x: item.x,
        y: item.y,
        rotation: item.rotation,
        width: item.width,
        depth: item.depth,
        height: item.height,
        color: item.color,
      })),
    },
  };
};

const materialCreateInputs = (plan: Plan): Prisma.MaterialCreateManyProjectInput[] =>
  plan.materials.map((material) => ({
    id: material.id,
    name: material.name,
    kind: material.kind,
    color: material.color,
    roughness: material.roughness,
  }));

/** Doors and windows must reference walls of the same plan: drop orphans before writing. */
const sanitizePlan = (plan: Plan): Plan => ({
  ...plan,
  floors: plan.floors.map((floor) => {
    const wallIds = new Set(floor.walls.map((wall) => wall.id));
    return {
      ...floor,
      doors: floor.doors.filter((door) => wallIds.has(door.wallId)),
      windows: floor.windows.filter((window) => wallIds.has(window.wallId)),
    };
  }),
});

export const listProjects = async (options: { limit?: number } = {}): Promise<ProjectSummary[]> => {
  const rows = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    take: options.limit,
    include: {
      floors: {
        orderBy: { level: "asc" },
        include: {
          rooms: { select: { id: true, name: true, type: true, x: true, y: true, width: true, depth: true } },
          walls: { select: { id: true, x1: true, y1: true, x2: true, y2: true, thickness: true } },
        },
      },
    },
  });
  return rows.map((row) => {
    const lot = { width: row.lotWidth, depth: row.lotDepth };
    const rooms = row.floors.flatMap((floor) => floor.rooms.map((room) => ({ ...room, type: asEnum(ROOM_TYPES, room.type, "other") })));
    const ground = row.floors[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      slug: row.slug,
      lotWidth: row.lotWidth,
      lotDepth: row.lotDepth,
      floorCount: row.floors.length,
      stats: statsFromRooms(rooms, lot),
      thumbnail: row.thumbnail,
      preview: {
        lot,
        rooms: ground ? ground.rooms.map((room) => ({ ...room, type: asEnum(ROOM_TYPES, room.type, "other") })) : [],
        walls: ground ? ground.walls.map((wall) => ({ id: wall.id, start: { x: wall.x1, y: wall.y1 }, end: { x: wall.x2, y: wall.y2 }, thickness: wall.thickness })) : [],
      },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
};

/** Stores the dashboard thumbnail (a small JPEG data URL rendered by the real 3D view). */
export const setProjectThumbnail = async (id: string, thumbnail: string): Promise<void> => {
  try {
    await prisma.project.update({ where: { id }, data: { thumbnail } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ProjectNotFoundError(id);
    }
    throw error;
  }
};

export const getDatabaseStatus = async (): Promise<DatabaseStatus> => {
  const [versionRows, projectCount, roomCount] = await Promise.all([
    prisma.$queryRaw<{ version: string }[]>`SELECT version()`,
    prisma.project.count(),
    prisma.room.count(),
  ]);
  return { version: versionRows[0]?.version ?? "inconnue", projectCount, roomCount };
};

export const getProjectPlan = async (id: string): Promise<Plan | null> => {
  const row = await prisma.project.findUnique({ where: { id }, ...projectWithPlan });
  return row ? toPlan(row) : null;
};

export const getProjectWithMeta = async (id: string): Promise<{ plan: Plan; updatedAt: Date } | null> => {
  const row = await prisma.project.findUnique({ where: { id }, ...projectWithPlan });
  return row ? { plan: toPlan(row), updatedAt: row.updatedAt } : null;
};

export const createProject = async (input: Plan): Promise<Plan> => {
  const plan = sanitizePlan(input);
  const row = await prisma.project.create({
    data: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      slug: plan.slug,
      lotWidth: plan.lot.width,
      lotDepth: plan.lot.depth,
      settings: plan.settings,
      materials: { create: materialCreateInputs(plan) },
      floors: { create: plan.floors.map(floorCreateInput) },
    },
    ...projectWithPlan,
  });
  return toPlan(row);
};

/**
 * Replaces the whole plan of an existing project inside one transaction.
 * Child rows are recreated with the ids chosen by the editor, so every
 * element keeps its identity across saves.
 */
export const replaceProjectPlan = async (input: Plan): Promise<{ updatedAt: Date }> => {
  const plan = sanitizePlan(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.project.findUnique({ where: { id: plan.id }, select: { id: true } });
    if (!existing) throw new ProjectNotFoundError(plan.id);
    await tx.floor.deleteMany({ where: { projectId: plan.id } });
    await tx.material.deleteMany({ where: { projectId: plan.id } });
    const row = await tx.project.update({
      where: { id: plan.id },
      data: {
        name: plan.name,
        description: plan.description,
        lotWidth: plan.lot.width,
        lotDepth: plan.lot.depth,
        settings: plan.settings,
        materials: { create: materialCreateInputs(plan) },
        floors: { create: plan.floors.map(floorCreateInput) },
      },
      select: { updatedAt: true },
    });
    return { updatedAt: row.updatedAt };
  });
};

export const deleteProject = async (id: string): Promise<void> => {
  try {
    await prisma.project.delete({ where: { id } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ProjectNotFoundError(id);
    }
    throw error;
  }
};

/**
 * Creates the project once per slug. Running the seed twice never duplicates
 * it; `reset` rewrites the stored plan from the builder.
 */
export const ensureProjectBySlug = async (
  plan: Plan,
  options: { reset?: boolean } = {},
): Promise<{ plan: Plan; created: boolean; reset: boolean }> => {
  if (!plan.slug) throw new Error("Un slug est requis pour un projet idempotent");
  const existing = await prisma.project.findUnique({ where: { slug: plan.slug }, select: { id: true } });
  if (!existing) {
    return { plan: await createProject(plan), created: true, reset: false };
  }
  if (options.reset) {
    await replaceProjectPlan({ ...plan, id: existing.id });
    return { plan: { ...plan, id: existing.id }, created: false, reset: true };
  }
  const stored = await getProjectPlan(existing.id);
  if (!stored) throw new ProjectNotFoundError(existing.id);
  return { plan: stored, created: false, reset: false };
};
