"use client";

import { Plus, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { MATERIAL_KIND_LABELS } from "@/domain/plan/labels";
import { MATERIAL_KINDS, type Material, type MaterialKind } from "@/domain/plan/schema";
import { usePlanStore } from "@/store/plan-store";

interface MaterialsEditorProps {
  /** Restrict the list to some kinds (all by default). */
  kinds?: MaterialKind[];
  compact?: boolean;
}

/** Edits the project's material library; every change updates the 3D scene live. */
export const MaterialsEditor = ({ kinds = [...MATERIAL_KINDS], compact = false }: MaterialsEditorProps) => {
  const materials = usePlanStore((state) => state.plan?.materials ?? []);
  const { addMaterial, updateMaterial, removeMaterial, commit } = usePlanStore.getState();

  const handleAdd = (kind: MaterialKind) => {
    addMaterial({ name: `${MATERIAL_KIND_LABELS[kind]} ${materials.filter((item) => item.kind === kind).length + 1}`, kind, color: "#cccccc", roughness: 0.8 });
  };

  return (
    <div className="flex flex-col gap-4">
      {kinds.map((kind) => {
        const items = materials.filter((material) => material.kind === kind);
        return (
          <section key={kind} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{MATERIAL_KIND_LABELS[kind]}</h3>
              <Button variant="ghost" size="xs" onClick={() => handleAdd(kind)}>
                <Plus data-icon="inline-start" />
                Ajouter
              </Button>
            </div>
            {items.length === 0 ? <p className="text-xs text-muted-foreground">Aucun matériau.</p> : null}
            {items.map((material) => (
              <MaterialRow
                key={material.id}
                material={material}
                compact={compact}
                onChange={(patch, transient) => updateMaterial(material.id, patch, { transient })}
                onCommit={commit}
                onRemove={() => removeMaterial(material.id)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
};

interface MaterialRowProps {
  material: Material;
  compact: boolean;
  onChange: (patch: Partial<Omit<Material, "id">>, transient?: boolean) => void;
  onCommit: () => void;
  onRemove: () => void;
}

const MaterialRow = ({ material, compact, onChange, onCommit, onRemove }: MaterialRowProps) => (
  <div className="grid gap-2 rounded-lg border bg-background p-2">
    <div className="flex items-center gap-2">
      <label className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border" title="Couleur">
        <input
          type="color"
          value={material.color}
          onChange={(event) => onChange({ color: event.target.value }, true)}
          onBlur={onCommit}
          className="absolute -inset-2 size-[200%] cursor-pointer border-0 p-0"
          aria-label={`Couleur de ${material.name}`}
        />
      </label>
      <Input value={material.name} onChange={(event) => onChange({ name: event.target.value }, true)} onBlur={onCommit} className="h-8 flex-1" aria-label="Nom du matériau" />
      {!compact ? (
        <Select value={material.kind} onValueChange={(kind) => onChange({ kind: kind as MaterialKind })}>
          <SelectTrigger className="w-32" aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MATERIAL_KINDS.map((kind) => (
              <SelectItem key={kind} value={kind}>
                {MATERIAL_KIND_LABELS[kind]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Supprimer ${material.name}`}>
        <Trash />
      </Button>
    </div>
    <div className="flex items-center gap-3">
      <Label className="w-16 shrink-0 text-xs text-muted-foreground">Rugosité</Label>
      <Slider
        value={[material.roughness]}
        min={0}
        max={1}
        step={0.05}
        onValueChange={([value]) => onChange({ roughness: value }, true)}
        onValueCommit={onCommit}
        aria-label="Rugosité"
      />
      <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{Math.round(material.roughness * 100)}%</span>
    </div>
  </div>
);
