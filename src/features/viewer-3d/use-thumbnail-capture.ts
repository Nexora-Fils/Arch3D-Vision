"use client";

import { useCallback, useEffect, type RefObject } from "react";
import { usePlanStore } from "@/store/plan-store";

const THUMBNAIL_WIDTH = 640;
const THUMBNAIL_HEIGHT = 400;
const FIRST_ATTEMPT_DELAY = 4500;
const RETRY_DELAY = 4000;
const MAX_ATTEMPTS = 4;

/** A frame that has not been rendered yet is uniform: never store it. */
const isBlank = (context: CanvasRenderingContext2D): boolean => {
  const { data } = context.getImageData(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
  const reference = [data[0], data[1], data[2]];
  for (let index = 0; index < data.length; index += 4 * 97) {
    if (Math.abs(data[index] - reference[0]) > 8 || Math.abs(data[index + 1] - reference[1]) > 8 || Math.abs(data[index + 2] - reference[2]) > 8) return false;
  }
  return true;
};

/**
 * Captures the real WebGL render as a small JPEG and stores it as the project
 * thumbnail: once after the scene has settled, then after every save.
 */
export const useThumbnailCapture = (sceneRef: RefObject<HTMLDivElement | null>, projectId: string) => {
  /** Returns false when nothing was rendered yet, so the caller can retry. */
  const capture = useCallback(async (): Promise<boolean> => {
    const source = sceneRef.current?.querySelector("canvas");
    if (!source || source.width === 0) return false;
    const target = document.createElement("canvas");
    target.width = THUMBNAIL_WIDTH;
    target.height = THUMBNAIL_HEIGHT;
    const context = target.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    const scale = Math.max(THUMBNAIL_WIDTH / source.width, THUMBNAIL_HEIGHT / source.height);
    const width = source.width * scale;
    const height = source.height * scale;
    context.drawImage(source, (THUMBNAIL_WIDTH - width) / 2, (THUMBNAIL_HEIGHT - height) / 2, width, height);
    if (isBlank(context)) return false;
    const dataUrl = target.toDataURL("image/jpeg", 0.72);
    await fetch(`/api/projects/${projectId}/thumbnail`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl }),
    }).catch(() => undefined);
    return true;
  }, [projectId, sceneRef]);

  useEffect(() => {
    let attempts = 0;
    let timer = 0;
    const attempt = async () => {
      attempts += 1;
      const done = await capture();
      if (!done && attempts < MAX_ATTEMPTS) timer = window.setTimeout(() => void attempt(), RETRY_DELAY);
    };
    timer = window.setTimeout(() => void attempt(), FIRST_ATTEMPT_DELAY);
    return () => window.clearTimeout(timer);
  }, [capture]);

  useEffect(
    () =>
      usePlanStore.subscribe((state, previous) => {
        if (state.lastSavedAt !== previous.lastSavedAt && state.lastSavedAt) {
          window.setTimeout(() => void capture(), 600);
        }
      }),
    [capture],
  );

  return capture;
};
