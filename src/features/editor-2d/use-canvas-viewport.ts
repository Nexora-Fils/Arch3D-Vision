"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Lot, Vec2 } from "@/domain/plan/schema";
import { MAX_ZOOM, MIN_ZOOM, pixelsPerMeter, useEditorStore } from "@/store/editor-store";

const ZOOM_FACTOR = 1.08;

/**
 * Size of the stage and view on the plan: fitted to the lot, zoomed with the
 * wheel or a pinch, panned by dragging the stage or while the space bar is held.
 */
export const useCanvasViewport = (stageRef: RefObject<KonvaStage | null>, lot: Pick<Lot, "width" | "depth">) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isSpaceHeld, setSpaceHeld] = useState(false);
  const pinchRef = useRef<{ distance: number; center: Vec2 } | null>(null);
  const zoom = useEditorStore((state) => state.zoom);
  const pan = useEditorStore((state) => state.pan);
  const fitRequest = useEditorStore((state) => state.fitRequest);
  const { setView } = useEditorStore.getState();
  const scale = pixelsPerMeter(zoom);

  // --- Stage sizing -------------------------------------------------------
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitToLot = useCallback(() => {
    if (size.width === 0) return;
    const margin = 60;
    const nextZoom =
      Math.min((size.width - margin * 2) / lot.width, (size.height - margin * 2) / lot.depth) / pixelsPerMeter(1);
    const boundedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    const nextScale = pixelsPerMeter(boundedZoom);
    setView({
      zoom: boundedZoom,
      pan: { x: (size.width - lot.width * nextScale) / 2, y: (size.height - lot.depth * nextScale) / 2 },
    });
  }, [lot.depth, lot.width, setView, size.height, size.width]);

  const hasFitted = useRef(false);
  useEffect(() => {
    if (size.width > 0 && !hasFitted.current) {
      hasFitted.current = true;
      fitToLot();
    }
  }, [fitToLot, size.width]);

  useEffect(() => {
    if (fitRequest > 0) fitToLot();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to explicit fit requests
  }, [fitRequest]);

  // --- Space bar panning ----------------------------------------------------
  useEffect(() => {
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTyping(event.target)) {
        event.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // --- Zoom with the wheel, keeping the point under the cursor fixed ------
  const handleWheel = (event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, direction > 0 ? zoom * ZOOM_FACTOR : zoom / ZOOM_FACTOR));
    const nextScale = pixelsPerMeter(nextZoom);
    const worldPoint = { x: (pointer.x - pan.x) / scale, y: (pointer.y - pan.y) / scale };
    setView({
      zoom: nextZoom,
      pan: { x: pointer.x - worldPoint.x * nextScale, y: pointer.y - worldPoint.y * nextScale },
    });
  };

  // --- Touch pinch zoom ----------------------------------------------------
  const handleTouchMove = (event: KonvaEventObject<TouchEvent>) => {
    const touches = event.evt.touches;
    if (touches.length !== 2) return;
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    stage.stopDrag();
    const rect = stage.container().getBoundingClientRect();
    const first = { x: touches[0].clientX - rect.left, y: touches[0].clientY - rect.top };
    const second = { x: touches[1].clientX - rect.left, y: touches[1].clientY - rect.top };
    const center = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    const previous = pinchRef.current;
    if (!previous) {
      pinchRef.current = { distance, center };
      return;
    }
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (distance / previous.distance)));
    const nextScale = pixelsPerMeter(nextZoom);
    const worldPoint = { x: (previous.center.x - pan.x) / scale, y: (previous.center.y - pan.y) / scale };
    setView({
      zoom: nextZoom,
      pan: { x: center.x - worldPoint.x * nextScale, y: center.y - worldPoint.y * nextScale },
    });
    pinchRef.current = { distance, center };
  };

  const handleTouchEnd = () => {
    pinchRef.current = null;
  };

  const handleDragEnd = (event: KonvaEventObject<DragEvent>) => {
    if (event.target === stageRef.current) {
      setView({ pan: { x: event.target.x(), y: event.target.y() } });
    }
  };

  return { containerRef, size, pan, scale, isSpaceHeld, handleWheel, handleTouchMove, handleTouchEnd, handleDragEnd };
};
