"use client";

import { useEffect, useLayoutEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Plan } from "@/domain/plan/schema";
import { useEditorStore } from "@/store/editor-store";
import { selectIsDirty, usePlanStore } from "@/store/plan-store";
import { useViewerStore } from "@/store/viewer-store";

interface ProjectProviderProps {
  plan: Plan;
  updatedAt: string;
  children: React.ReactNode;
}

/**
 * Hydrates the client stores with the plan loaded from PostgreSQL. The plan is
 * only (re)loaded when the project id changes, so unsaved edits survive
 * navigation between the editor, the 3D view and the walkthrough.
 */
export const ProjectProvider = ({ plan, updatedAt, children }: ProjectProviderProps) => {
  const loadedId = usePlanStore((state) => state.plan?.id);
  const isDirty = usePlanStore(selectIsDirty);

  useLayoutEffect(() => {
    if (usePlanStore.getState().plan?.id === plan.id) return;
    usePlanStore.getState().load(plan, new Date(updatedAt));
    const firstFloorId = plan.floors[0]?.id ?? null;
    useEditorStore.getState().setActiveFloor(firstFloorId);
    useEditorStore.getState().setView({ zoom: 1, pan: { x: 40, y: 40 } });
    useViewerStore.getState().setWalkFloor(firstFloorId);
  }, [plan, updatedAt]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  if (loadedId !== plan.id) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="h-14 bg-midnight" />
        <Skeleton className="m-3 flex-1" />
      </div>
    );
  }
  return children;
};
