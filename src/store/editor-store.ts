import { create } from "zustand";
import type { FurnitureType, Vec2 } from "@/domain/plan/schema";

export const EDITOR_TOOLS = ["select", "pan", "room", "wall", "door", "window", "stairs", "furniture", "text", "dimension"] as const;
export type EditorTool = (typeof EDITOR_TOOLS)[number];

export type SelectionKind = "room" | "wall" | "door" | "window" | "furniture" | "annotation";

export interface Selection {
  kind: SelectionKind;
  id: string;
}

/** Pixels per meter at zoom 1. */
export const BASE_PIXELS_PER_METER = 50;
export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 6;

interface EditorState {
  tool: EditorTool;
  selection: Selection | null;
  activeFloorId: string | null;
  furnitureType: FurnitureType;
  gridStep: number;
  showGrid: boolean;
  showDimensions: boolean;
  zoom: number;
  pan: Vec2;
  /** Incremented to ask the canvas to fit the lot in view. */
  fitRequest: number;

  setTool: (tool: EditorTool) => void;
  select: (selection: Selection | null) => void;
  setActiveFloor: (floorId: string | null) => void;
  setFurnitureType: (type: FurnitureType) => void;
  setGridStep: (step: number) => void;
  toggleGrid: () => void;
  toggleDimensions: () => void;
  setView: (view: { zoom?: number; pan?: Vec2 }) => void;
  requestFit: () => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  tool: "select",
  selection: null,
  activeFloorId: null,
  furnitureType: "sofa",
  gridStep: 0.1,
  showGrid: true,
  showDimensions: true,
  zoom: 1,
  pan: { x: 40, y: 40 },
  fitRequest: 0,

  setTool: (tool) => set((state) => ({ tool, selection: tool === "select" ? state.selection : null })),
  select: (selection) => set({ selection }),
  setActiveFloor: (activeFloorId) => set({ activeFloorId, selection: null }),
  setFurnitureType: (furnitureType) => set({ furnitureType }),
  setGridStep: (gridStep) => set({ gridStep }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),
  setView: ({ zoom, pan }) =>
    set((state) => ({
      zoom: zoom === undefined ? state.zoom : Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)),
      pan: pan ?? state.pan,
    })),
  requestFit: () => set((state) => ({ fitRequest: state.fitRequest + 1 })),
}));

export const pixelsPerMeter = (zoom: number): number => BASE_PIXELS_PER_METER * zoom;
