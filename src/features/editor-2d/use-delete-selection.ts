"use client";

import { useCallback } from "react";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

/** Deletes whatever is selected in the editor (room, wall, opening or furniture). */
export const useDeleteSelection = () =>
  useCallback(() => {
    const { selection, activeFloorId, select } = useEditorStore.getState();
    const store = usePlanStore.getState();
    const floorId = activeFloorId ?? store.plan?.floors[0]?.id;
    if (!selection || !floorId) return;
    switch (selection.kind) {
      case "room":
        store.removeRoom(floorId, selection.id);
        break;
      case "wall":
        store.removeWall(floorId, selection.id);
        break;
      case "door":
        store.removeDoor(floorId, selection.id);
        break;
      case "window":
        store.removeWindow(floorId, selection.id);
        break;
      case "furniture":
        store.removeFurniture(floorId, selection.id);
        break;
      case "annotation":
        store.removeAnnotation(floorId, selection.id);
        break;
    }
    select(null);
  }, []);
