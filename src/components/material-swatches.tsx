"use client";

import { Check } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Material } from "@/domain/plan/schema";
import { PHOTO_TEXTURES } from "@/features/viewer-3d/photo-textures";
import { photoForMaterial } from "@/features/viewer-3d/textures";
import { cn } from "@/lib/utils";

interface MaterialSwatchesProps {
  materials: Material[];
  value: string | null;
  onSelect: (materialId: string) => void;
  /** Accessible group label. */
  label: string;
}

/** Click-to-apply swatches showing the material's real texture, tinted with its color. */
export const MaterialSwatches = ({ materials, value, onSelect, label }: MaterialSwatchesProps) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
    {materials.length === 0 ? <p className="text-xs text-muted-foreground">Aucun matériau de ce type.</p> : null}
    {materials.map((material) => {
      const isSelected = material.id === value;
      return (
        <Tooltip key={material.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onSelect(material.id)}
              aria-label={material.name}
              aria-pressed={isSelected}
              className={cn(
                "flex size-10 items-center justify-center rounded-lg border-2 shadow-sm transition-transform hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                isSelected ? "border-electric" : "border-black/10",
              )}
              style={{
                backgroundColor: material.color,
                backgroundImage: `url(/textures/${PHOTO_TEXTURES[photoForMaterial(material)].dir}/diff.jpg)`,
                backgroundSize: "200%",
                backgroundBlendMode: "multiply",
              }}
            >
              {isSelected ? <Check className="size-4 text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]" aria-hidden /> : null}
            </button>
          </TooltipTrigger>
          <TooltipContent>{material.name}</TooltipContent>
        </Tooltip>
      );
    })}
  </div>
);
