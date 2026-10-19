import { create } from "zustand";

export const CAMERA_PRESETS = ["main", "threeQuarter", "front", "back", "aerial"] as const;
export type CameraPreset = (typeof CAMERA_PRESETS)[number];

export type TimeOfDay = "day" | "evening";

export const QUALITY_LEVELS = ["auto", "low", "high"] as const;
export type QualityLevel = (typeof QUALITY_LEVELS)[number];

/** "auto" picks the economical profile on small or weak devices. */
export const resolveQuality = (quality: QualityLevel): "low" | "high" => {
  if (quality !== "auto") return quality;
  if (typeof navigator === "undefined") return "high";
  const isCoarsePointer = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const fewCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  return isCoarsePointer || fewCores ? "low" : "high";
};

interface ViewerState {
  showRoof: boolean;
  timeOfDay: TimeOfDay;
  quality: QualityLevel;
  /** Slow automatic orbit around the house. */
  autoRotate: boolean;
  hiddenFloorIds: string[];
  cameraPreset: CameraPreset;
  /** Incremented every time a preset is requested so the camera animates again. */
  cameraRequest: number;
  walkFloorId: string | null;

  toggleRoof: () => void;
  setShowRoof: (showRoof: boolean) => void;
  setHiddenFloors: (floorIds: string[]) => void;
  toggleTimeOfDay: () => void;
  setQuality: (quality: QualityLevel) => void;
  toggleAutoRotate: () => void;
  setFloorVisible: (floorId: string, visible: boolean) => void;
  requestCamera: (preset: CameraPreset) => void;
  setWalkFloor: (floorId: string | null) => void;
}

export const useViewerStore = create<ViewerState>()((set) => ({
  showRoof: true,
  timeOfDay: "evening",
  quality: "auto",
  autoRotate: false,
  hiddenFloorIds: [],
  cameraPreset: "main",
  cameraRequest: 0,
  walkFloorId: null,

  toggleRoof: () => set((state) => ({ showRoof: !state.showRoof })),
  setShowRoof: (showRoof) => set({ showRoof }),
  setHiddenFloors: (hiddenFloorIds) => set({ hiddenFloorIds }),
  toggleTimeOfDay: () => set((state) => ({ timeOfDay: state.timeOfDay === "day" ? "evening" : "day" })),
  setQuality: (quality) => set({ quality }),
  toggleAutoRotate: () => set((state) => ({ autoRotate: !state.autoRotate })),
  setFloorVisible: (floorId, visible) =>
    set((state) => ({
      hiddenFloorIds: visible ? state.hiddenFloorIds.filter((id) => id !== floorId) : [...new Set([...state.hiddenFloorIds, floorId])],
    })),
  requestCamera: (cameraPreset) => set((state) => ({ cameraPreset, cameraRequest: state.cameraRequest + 1 })),
  setWalkFloor: (walkFloorId) => set({ walkFloorId }),
}));
