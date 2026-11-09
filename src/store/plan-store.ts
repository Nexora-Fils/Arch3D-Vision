import { create } from "zustand";
import { createId } from "@/domain/plan/ids";
import { floorNameForLevel } from "@/domain/plan/factory";
import { buildWallSegments, clampOpeningOffset, createRoomWalls, floorBelow, isOutdoorRoom, syncRoomWalls, translateWall } from "@/domain/plan/geometry";
import { applyStylePreset, type StylePresetKey } from "@/domain/plan/style-presets";
import type {
  Annotation,
  Door,
  Floor,
  Furniture,
  Lot,
  Material,
  Plan,
  PlanSettings,
  Room,
  Vec2,
  Wall,
  Window,
} from "@/domain/plan/schema";

const HISTORY_LIMIT = 60;

export interface MutationOptions {
  /** Transient updates (drags) do not create history entries until `commit()`. */
  transient?: boolean;
}

type PlanMutator = (plan: Plan) => Plan;
type FloorMutator = (floor: Floor) => Floor;

interface PlanStoreState {
  plan: Plan | null;
  savedPlan: Plan | null;
  past: Plan[];
  future: Plan[];
  pendingHistory: Plan | null;
  isSaving: boolean;
  lastSavedAt: Date | null;

  load: (plan: Plan, savedAt?: Date | null) => void;
  markSaved: (savedPlan: Plan, savedAt: Date) => void;
  setSaving: (isSaving: boolean) => void;
  undo: () => void;
  redo: () => void;
  commit: () => void;

  updateProject: (patch: Partial<Pick<Plan, "name" | "description">> & { lot?: Partial<Lot> }, options?: MutationOptions) => void;
  updateSettings: (patch: Partial<PlanSettings>, options?: MutationOptions) => void;

  addFloor: (copyExteriorWalls?: boolean) => Floor | null;
  updateFloor: (floorId: string, patch: Partial<Pick<Floor, "name" | "height">>, options?: MutationOptions) => void;
  removeFloor: (floorId: string) => void;

  addRoom: (floorId: string, room: Omit<Room, "id">, options?: { withWalls?: boolean }) => Room | null;
  updateRoom: (floorId: string, roomId: string, patch: Partial<Omit<Room, "id">>, options?: MutationOptions) => void;
  moveRoom: (floorId: string, roomId: string, delta: Vec2, options?: MutationOptions) => void;
  removeRoom: (floorId: string, roomId: string) => void;

  addWall: (floorId: string, wall: Omit<Wall, "id">) => Wall | null;
  updateWall: (floorId: string, wallId: string, patch: Partial<Omit<Wall, "id">>, options?: MutationOptions) => void;
  removeWall: (floorId: string, wallId: string) => void;

  addDoor: (floorId: string, door: Omit<Door, "id">) => Door | null;
  updateDoor: (floorId: string, doorId: string, patch: Partial<Omit<Door, "id">>, options?: MutationOptions) => void;
  removeDoor: (floorId: string, doorId: string) => void;

  addWindow: (floorId: string, window: Omit<Window, "id">) => Window | null;
  updateWindow: (floorId: string, windowId: string, patch: Partial<Omit<Window, "id">>, options?: MutationOptions) => void;
  removeWindow: (floorId: string, windowId: string) => void;

  addFurniture: (floorId: string, item: Omit<Furniture, "id">) => Furniture | null;
  updateFurniture: (floorId: string, itemId: string, patch: Partial<Omit<Furniture, "id">>, options?: MutationOptions) => void;
  removeFurniture: (floorId: string, itemId: string) => void;

  applyStylePreset: (key: StylePresetKey) => void;
  addAnnotation: (floorId: string, annotation: Omit<Annotation, "id">) => Annotation | null;
  updateAnnotation: (floorId: string, annotationId: string, patch: Partial<Omit<Annotation, "id">>, options?: MutationOptions) => void;
  removeAnnotation: (floorId: string, annotationId: string) => void;

  addMaterial: (material: Omit<Material, "id">) => Material | null;
  updateMaterial: (materialId: string, patch: Partial<Omit<Material, "id">>, options?: MutationOptions) => void;
  removeMaterial: (materialId: string) => void;
}

const updateFloorIn = (plan: Plan, floorId: string, mutate: FloorMutator): Plan => {
  const index = plan.floors.findIndex((floor) => floor.id === floorId);
  if (index === -1) return plan;
  const floors = [...plan.floors];
  floors[index] = mutate(floors[index]);
  return { ...plan, floors };
};

const patchById = <T extends { id: string }>(items: T[], id: string, patch: NoInfer<Partial<Omit<T, "id">>>): T[] =>
  items.map((item) => (item.id === id ? { ...item, ...patch } : item));

const fitOpenings = (floor: Floor): Floor => {
  const wallsById = new Map(floor.walls.map((wall) => [wall.id, wall]));
  const fit = <T extends Door | Window>(opening: T): T => {
    const wall = wallsById.get(opening.wallId);
    return wall ? { ...opening, offset: clampOpeningOffset(wall, opening.width, opening.offset) } : opening;
  };
  return { ...floor, doors: floor.doors.map(fit), windows: floor.windows.map(fit) };
};

const removeWallsFrom = (floor: Floor, wallIds: Set<string>): Floor => ({
  ...floor,
  walls: floor.walls.filter((wall) => !wallIds.has(wall.id)),
  doors: floor.doors.filter((door) => !wallIds.has(door.wallId)),
  windows: floor.windows.filter((window) => !wallIds.has(window.wallId)),
});

export const usePlanStore = create<PlanStoreState>()((set, get) => {
  const mutate = (mutator: PlanMutator, options?: MutationOptions) => {
    set((state) => {
      if (!state.plan) return state;
      const next = mutator(state.plan);
      if (next === state.plan) return state;
      if (options?.transient) {
        return { plan: next, pendingHistory: state.pendingHistory ?? state.plan };
      }
      const previous = state.pendingHistory ?? state.plan;
      return {
        plan: next,
        past: [...state.past, previous].slice(-HISTORY_LIMIT),
        future: [],
        pendingHistory: null,
      };
    });
  };

  const mutateFloor = (floorId: string, mutator: FloorMutator, options?: MutationOptions) =>
    mutate((plan) => updateFloorIn(plan, floorId, mutator), options);

  const requirePlan = (): Plan | null => get().plan;

  return {
    plan: null,
    savedPlan: null,
    past: [],
    future: [],
    pendingHistory: null,
    isSaving: false,
    lastSavedAt: null,

    load: (plan, savedAt = null) =>
      set({ plan, savedPlan: plan, past: [], future: [], pendingHistory: null, lastSavedAt: savedAt, isSaving: false }),

    markSaved: (savedPlan, savedAt) => set({ savedPlan, lastSavedAt: savedAt, isSaving: false }),

    setSaving: (isSaving) => set({ isSaving }),

    undo: () =>
      set((state) => {
        if (!state.plan || state.past.length === 0) return state;
        const previous = state.past[state.past.length - 1];
        return { plan: previous, past: state.past.slice(0, -1), future: [state.plan, ...state.future], pendingHistory: null };
      }),

    redo: () =>
      set((state) => {
        if (!state.plan || state.future.length === 0) return state;
        const [next, ...rest] = state.future;
        return { plan: next, past: [...state.past, state.plan], future: rest, pendingHistory: null };
      }),

    commit: () =>
      set((state) =>
        state.pendingHistory
          ? { past: [...state.past, state.pendingHistory].slice(-HISTORY_LIMIT), future: [], pendingHistory: null }
          : state,
      ),

    updateProject: ({ lot, ...patch }, options) =>
      mutate((plan) => ({ ...plan, ...patch, lot: lot ? { ...plan.lot, ...lot } : plan.lot }), options),

    updateSettings: (patch, options) => mutate((plan) => ({ ...plan, settings: { ...plan.settings, ...patch } }), options),

    addFloor: (copyExteriorWalls = false) => {
      const plan = requirePlan();
      if (!plan) return null;
      const level = Math.max(...plan.floors.map((floor) => floor.level)) + 1;
      const lowerFloor = floorBelow(plan.floors, level);
      const sourceFloor = plan.floors.find((candidate) => candidate.level === 0) ?? lowerFloor;
      const exteriorWallIds =
        copyExteriorWalls && sourceFloor
          ? new Set(buildWallSegments(sourceFloor).filter((segment) => segment.exteriorSide !== 0).flatMap((segment) => segment.sourceWallIds))
          : new Set<string>();
      const floor: Floor = {
        id: createId(),
        name: floorNameForLevel(level),
        level,
        height: plan.settings.defaultWallHeight,
        rooms: [],
        walls: sourceFloor
          ? sourceFloor.walls
              .filter((wall) => exteriorWallIds.has(wall.id))
              .map((wall) => ({ ...wall, id: createId(), roomId: null, side: null }))
          : [],
        doors: [],
        windows: [],
        furniture: [],
        annotations: [],
      };
      mutate((current) => ({ ...current, floors: [...current.floors, floor] }));
      return floor;
    },

    updateFloor: (floorId, patch, options) => mutateFloor(floorId, (floor) => ({ ...floor, ...patch }), options),

    removeFloor: (floorId) =>
      mutate((plan) => (plan.floors.length <= 1 ? plan : { ...plan, floors: plan.floors.filter((floor) => floor.id !== floorId) })),

    addRoom: (floorId, input, options) => {
      const plan = requirePlan();
      if (!plan) return null;
      const room: Room = { ...input, id: createId() };
      mutateFloor(floorId, (floor) => {
        const walls =
          options?.withWalls === false || isOutdoorRoom(room)
            ? floor.walls
            : [
                ...floor.walls,
                ...createRoomWalls(
                  room,
                  {
                    thickness: plan.settings.defaultWallThickness,
                    height: floor.height,
                    materialId: plan.materials.find((material) => material.kind === "wall")?.id ?? null,
                  },
                  createId,
                ),
              ];
        return { ...floor, rooms: [...floor.rooms, room], walls };
      });
      return room;
    },

    updateRoom: (floorId, roomId, patch, options) =>
      mutateFloor(
        floorId,
        (floor) => {
          const room = floor.rooms.find((item) => item.id === roomId);
          if (!room) return floor;
          const nextRoom = { ...room, ...patch };
          return fitOpenings({
            ...floor,
            rooms: patchById(floor.rooms, roomId, nextRoom),
            walls: syncRoomWalls(floor.walls, nextRoom),
          });
        },
        options,
      ),

    moveRoom: (floorId, roomId, delta, options) =>
      mutateFloor(
        floorId,
        (floor) => {
          const room = floor.rooms.find((item) => item.id === roomId);
          if (!room) return floor;
          const nextRoom = { ...room, x: room.x + delta.x, y: room.y + delta.y };
          return {
            ...floor,
            rooms: patchById(floor.rooms, roomId, nextRoom),
            walls: floor.walls.map((wall) => (wall.roomId === roomId ? translateWall(wall, delta) : wall)),
          };
        },
        options,
      ),

    removeRoom: (floorId, roomId) =>
      mutateFloor(floorId, (floor) => {
        const wallIds = new Set(floor.walls.filter((wall) => wall.roomId === roomId).map((wall) => wall.id));
        const stripped = removeWallsFrom(floor, wallIds);
        return { ...stripped, rooms: stripped.rooms.filter((room) => room.id !== roomId) };
      }),

    addWall: (floorId, input) => {
      if (!requirePlan()) return null;
      const wall: Wall = { ...input, id: createId() };
      mutateFloor(floorId, (floor) => ({ ...floor, walls: [...floor.walls, wall] }));
      return wall;
    },

    updateWall: (floorId, wallId, patch, options) =>
      mutateFloor(floorId, (floor) => fitOpenings({ ...floor, walls: patchById(floor.walls, wallId, patch) }), options),

    removeWall: (floorId, wallId) => mutateFloor(floorId, (floor) => removeWallsFrom(floor, new Set([wallId]))),

    addDoor: (floorId, input) => {
      if (!requirePlan()) return null;
      const door: Door = { ...input, id: createId() };
      mutateFloor(floorId, (floor) => fitOpenings({ ...floor, doors: [...floor.doors, door] }));
      return door;
    },

    updateDoor: (floorId, doorId, patch, options) =>
      mutateFloor(floorId, (floor) => fitOpenings({ ...floor, doors: patchById(floor.doors, doorId, patch) }), options),

    removeDoor: (floorId, doorId) =>
      mutateFloor(floorId, (floor) => ({ ...floor, doors: floor.doors.filter((door) => door.id !== doorId) })),

    addWindow: (floorId, input) => {
      if (!requirePlan()) return null;
      const window: Window = { ...input, id: createId() };
      mutateFloor(floorId, (floor) => fitOpenings({ ...floor, windows: [...floor.windows, window] }));
      return window;
    },

    updateWindow: (floorId, windowId, patch, options) =>
      mutateFloor(floorId, (floor) => fitOpenings({ ...floor, windows: patchById(floor.windows, windowId, patch) }), options),

    removeWindow: (floorId, windowId) =>
      mutateFloor(floorId, (floor) => ({ ...floor, windows: floor.windows.filter((window) => window.id !== windowId) })),

    addFurniture: (floorId, input) => {
      if (!requirePlan()) return null;
      const item: Furniture = { ...input, id: createId() };
      mutateFloor(floorId, (floor) => ({ ...floor, furniture: [...floor.furniture, item] }));
      return item;
    },

    updateFurniture: (floorId, itemId, patch, options) =>
      mutateFloor(floorId, (floor) => ({ ...floor, furniture: patchById(floor.furniture, itemId, patch) }), options),

    removeFurniture: (floorId, itemId) =>
      mutateFloor(floorId, (floor) => ({ ...floor, furniture: floor.furniture.filter((item) => item.id !== itemId) })),

    addAnnotation: (floorId, input) => {
      if (!requirePlan()) return null;
      const annotation: Annotation = { ...input, id: createId() };
      mutateFloor(floorId, (floor) => ({ ...floor, annotations: [...floor.annotations, annotation] }));
      return annotation;
    },

    updateAnnotation: (floorId, annotationId, patch, options) =>
      mutateFloor(floorId, (floor) => ({ ...floor, annotations: patchById(floor.annotations, annotationId, patch) }), options),

    removeAnnotation: (floorId, annotationId) =>
      mutateFloor(floorId, (floor) => ({ ...floor, annotations: floor.annotations.filter((item) => item.id !== annotationId) })),

    applyStylePreset: (key) => mutate((plan) => applyStylePreset(plan, key)),

    addMaterial: (input) => {
      if (!requirePlan()) return null;
      const material: Material = { ...input, id: createId() };
      mutate((plan) => ({ ...plan, materials: [...plan.materials, material] }));
      return material;
    },

    updateMaterial: (materialId, patch, options) =>
      mutate((plan) => ({ ...plan, materials: patchById(plan.materials, materialId, patch) }), options),

    removeMaterial: (materialId) =>
      mutate((plan) => ({
        ...plan,
        materials: plan.materials.filter((material) => material.id !== materialId),
        settings: {
          ...plan.settings,
          roofMaterialId: plan.settings.roofMaterialId === materialId ? null : plan.settings.roofMaterialId,
          exteriorMaterialId: plan.settings.exteriorMaterialId === materialId ? null : plan.settings.exteriorMaterialId,
        },
        floors: plan.floors.map((floor) => ({
          ...floor,
          rooms: floor.rooms.map((room) => (room.floorMaterialId === materialId ? { ...room, floorMaterialId: null } : room)),
          walls: floor.walls.map((wall) => (wall.materialId === materialId ? { ...wall, materialId: null } : wall)),
        })),
      })),
  };
});

export const selectIsDirty = (state: PlanStoreState): boolean => state.plan !== state.savedPlan;
export const selectCanUndo = (state: PlanStoreState): boolean => state.past.length > 0;
export const selectCanRedo = (state: PlanStoreState): boolean => state.future.length > 0;
export const selectFloor = (floorId: string | null) => (state: PlanStoreState): Floor | null =>
  state.plan?.floors.find((floor) => floor.id === floorId) ?? state.plan?.floors[0] ?? null;
