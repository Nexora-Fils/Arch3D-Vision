"use client";

import type { Floor } from "@/domain/plan/schema";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

/** The floor currently edited; falls back to the first floor of the plan. */
export const useActiveFloor = (): Floor | null => {
  const activeFloorId = useEditorStore((state) => state.activeFloorId);
  return usePlanStore((state) => state.plan?.floors.find((floor) => floor.id === activeFloorId) ?? state.plan?.floors[0] ?? null);
};
