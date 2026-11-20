"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Annotation } from "@/domain/plan/schema";
import { formatDimension } from "@/features/editor-2d/canvas/annotation-shape";
import { DeleteButton, PanelSection } from "@/features/editor-2d/properties/parts";
import { usePlanStore } from "@/store/plan-store";

interface AnnotationPropertiesProps {
  annotation: Annotation;
  floorId: string;
}

export const AnnotationProperties = ({ annotation, floorId }: AnnotationPropertiesProps) => {
  const { updateAnnotation, commit } = usePlanStore.getState();
  const isText = annotation.kind === "text";
  return (
    <>
      <PanelSection title={isText ? "Texte" : "Cotation"}>
        {isText ? null : (
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Longueur mesurée</span>
            <span className="font-medium tabular-nums">{formatDimension(annotation.start, annotation.end)}</span>
          </div>
        )}
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">
            {isText ? "Contenu" : "Libellé (vide = longueur mesurée)"}
          </Label>
          <Input
            value={annotation.text}
            maxLength={80}
            onChange={(event) =>
              updateAnnotation(floorId, annotation.id, { text: event.target.value }, { transient: true })
            }
            onBlur={commit}
          />
        </div>
      </PanelSection>
      <DeleteButton label={isText ? "Supprimer le texte" : "Supprimer la cote"} />
    </>
  );
};
