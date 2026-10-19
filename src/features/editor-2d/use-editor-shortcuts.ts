"use client";

import { useEffect } from "react";
import { useEditorStore, type EditorTool } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";
import { useDeleteSelection } from "@/features/editor-2d/use-delete-selection";

const TOOL_KEYS: Record<string, EditorTool> = {
  v: "select",
  h: "pan",
  r: "room",
  w: "wall",
  d: "door",
  f: "window",
  m: "furniture",
  e: "stairs",
  t: "text",
  c: "dimension",
};

const isTypingTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export const useEditorShortcuts = () => {
  const deleteSelection = useDeleteSelection();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const editor = useEditorStore.getState();
      const key = event.key.toLowerCase();
      const withModifier = event.metaKey || event.ctrlKey;

      if (withModifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) usePlanStore.getState().redo();
        else usePlanStore.getState().undo();
        return;
      }
      if (withModifier && key === "y") {
        event.preventDefault();
        usePlanStore.getState().redo();
        return;
      }
      if (withModifier) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        if (editor.selection) {
          event.preventDefault();
          deleteSelection();
        }
        return;
      }
      if (event.key === "Escape") {
        editor.select(null);
        editor.setTool("select");
        return;
      }
      if (key in TOOL_KEYS) {
        editor.setTool(TOOL_KEYS[key]);
        return;
      }
      if (key === "g") editor.toggleGrid();
      if (event.key === "+" || event.key === "=") editor.setView({ zoom: editor.zoom * 1.2 });
      if (event.key === "-") editor.setView({ zoom: editor.zoom / 1.2 });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelection]);
};
