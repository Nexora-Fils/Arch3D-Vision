"use client";

import { Trash } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatMeters, wallLength } from "@/domain/plan/geometry";
import type { Wall } from "@/domain/plan/schema";
import { useDeleteSelection } from "@/features/editor-2d/use-delete-selection";

interface PanelSectionProps {
  title: string;
  children: ReactNode;
}

export const PanelSection = ({ title, children }: PanelSectionProps) => (
  <section className="flex flex-col gap-3">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
    {children}
  </section>
);

interface DeleteButtonProps {
  label: string;
}

export const DeleteButton = ({ label }: DeleteButtonProps) => {
  const deleteSelection = useDeleteSelection();
  return (
    <Button variant="destructive" onClick={deleteSelection} className="mt-2 w-full">
      <Trash data-icon="inline-start" />
      {label}
    </Button>
  );
};

interface OffsetSliderProps {
  wall: Wall;
  width: number;
  offset: number;
  onChange: (offset: number) => void;
  onCommit: () => void;
}

export const OffsetSlider = ({ wall, width, offset, onChange, onCommit }: OffsetSliderProps) => {
  const length = wallLength(wall);
  const min = Math.min(width / 2, length / 2);
  const max = Math.max(length - width / 2, length / 2);
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Position sur le mur</Label>
        <span className="text-xs tabular-nums text-muted-foreground">{formatMeters(offset)}</span>
      </div>
      <Slider
        value={[offset]}
        min={min}
        max={max}
        step={0.05}
        onValueChange={([value]) => onChange(value)}
        onValueCommit={onCommit}
        aria-label="Position sur le mur"
      />
    </div>
  );
};
