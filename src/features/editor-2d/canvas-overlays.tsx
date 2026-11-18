"use client";

import { Minus, Plus } from "lucide-react";
import { useEditorStore } from "@/store/editor-store";

interface ScaleBarProps {
  /** Pixels per meter at the current zoom. */
  scale: number;
}

/** Graphic scale, bottom left of the canvas. */
export const ScaleBar = ({ scale }: ScaleBarProps) => {
  const scaleBarMeters = scale >= 40 ? 5 : scale >= 15 ? 10 : 20;
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 rounded-md bg-[#0f1a33]/85 px-3 py-2 text-[10px] text-white/80 shadow-lg backdrop-blur">
      <div className="relative h-3" style={{ width: scaleBarMeters * scale }}>
        {Array.from({ length: 6 }, (_, index) => (
          <span
            key={index}
            className="absolute top-0 h-2 w-px bg-white/80"
            style={{ left: (index / 5) * scaleBarMeters * scale }}
          />
        ))}
        <span className="absolute top-2 left-0 h-px w-full bg-white/80" />
      </div>
      <div className="relative mt-0.5 h-3" style={{ width: scaleBarMeters * scale }}>
        {[0, 1, 2, 3, 5].map((step) => (
          <span
            key={step}
            className="absolute -translate-x-1/2 tabular-nums"
            style={{ left: (step / 5) * scaleBarMeters * scale }}
          >
            {(step * scaleBarMeters) / 5}
            {step === 5 ? " m" : ""}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Zoom and grid controls, bottom right of the canvas. */
export const ZoomControls = () => {
  const zoom = useEditorStore((state) => state.zoom);
  const showGrid = useEditorStore((state) => state.showGrid);
  const showGridToggle = useEditorStore((state) => state.toggleGrid);
  const { setView } = useEditorStore.getState();
  const zoomBy = (factor: number) => setView({ zoom: zoom * factor });
  return (
    <div className="absolute right-4 bottom-4 flex items-center gap-1 rounded-lg border border-white/10 bg-[#0f1a33]/90 p-1 text-white shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => zoomBy(1.25)}
        className="flex size-7 items-center justify-center rounded-md hover:bg-white/10"
        aria-label="Zoom avant"
      >
        <Plus className="size-4" />
      </button>
      <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
      <button
        type="button"
        onClick={() => zoomBy(1 / 1.25)}
        className="flex size-7 items-center justify-center rounded-md hover:bg-white/10"
        aria-label="Zoom arrière"
      >
        <Minus className="size-4" />
      </button>
      <span className="mx-1 h-5 w-px bg-white/15" />
      <label className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-white/10">
        <input type="checkbox" checked={showGrid} onChange={showGridToggle} className="size-3.5 accent-[#2563eb]" />
        Grille
      </label>
    </div>
  );
};
