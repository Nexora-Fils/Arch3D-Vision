"use client";

import { NumberField } from "@/components/number-field";
import type { Wall, Window } from "@/domain/plan/schema";
import { DeleteButton, OffsetSlider, PanelSection } from "@/features/editor-2d/properties/parts";
import { usePlanStore } from "@/store/plan-store";

interface WindowPropertiesProps {
  window: Window;
  wall: Wall;
  floorId: string;
}

export const WindowProperties = ({ window, wall, floorId }: WindowPropertiesProps) => {
  const { updateWindow, commit } = usePlanStore.getState();
  return (
    <>
      <PanelSection title="Fenêtre">
        <OffsetSlider
          wall={wall}
          width={window.width}
          offset={window.offset}
          onChange={(offset) => updateWindow(floorId, window.id, { offset }, { transient: true })}
          onCommit={commit}
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Largeur"
            unit="m"
            min={0.3}
            max={4}
            step={0.05}
            value={window.width}
            onChange={(width) => updateWindow(floorId, window.id, { width })}
          />
          <NumberField
            label="Hauteur"
            unit="m"
            min={0.3}
            max={3}
            step={0.05}
            value={window.height}
            onChange={(height) => updateWindow(floorId, window.id, { height })}
          />
          <NumberField
            label="Allège (hauteur du bas)"
            unit="m"
            min={0}
            max={2.5}
            step={0.05}
            value={window.sillHeight}
            onChange={(sillHeight) => updateWindow(floorId, window.id, { sillHeight })}
          />
        </div>
      </PanelSection>
      <DeleteButton label="Supprimer la fenêtre" />
    </>
  );
};
