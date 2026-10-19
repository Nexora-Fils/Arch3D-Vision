import { create } from "zustand";
import type { Vec2 } from "@/domain/plan/schema";

interface WalkState {
  position: Vec2;
  yaw: number;
  roomId: string | null;
  update: (position: Vec2, yaw: number, roomId: string | null) => void;
}

/** Visitor position published by the controller (~10 Hz) for the HUD and the minimap. */
export const useWalkState = create<WalkState>()((set) => ({
  position: { x: 0, y: 0 },
  yaw: 0,
  roomId: null,
  update: (position, yaw, roomId) => set({ position, yaw, roomId }),
}));
