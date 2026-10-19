"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import type { ApiError } from "@/lib/api/respond";
import { usePlanStore } from "@/store/plan-store";

/** Persists the in-memory plan with PUT /api/projects/:id. */
export const useSaveProject = () => {
  return useCallback(async (): Promise<boolean> => {
    const { plan, isSaving, setSaving, markSaved } = usePlanStore.getState();
    if (!plan || isSaving) return false;
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ApiError | null;
        const detail = body?.issues?.[0] ? ` (${body.issues[0].path} : ${body.issues[0].message})` : "";
        throw new Error(`${body?.error ?? `Erreur HTTP ${response.status}`}${detail}`);
      }
      const { updatedAt } = (await response.json()) as { updatedAt: string };
      markSaved(plan, new Date(updatedAt));
      toast.success("Projet enregistré");
      return true;
    } catch (error) {
      setSaving(false);
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible");
      return false;
    }
  }, []);
};
