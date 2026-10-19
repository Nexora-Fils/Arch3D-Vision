"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Material, MaterialKind } from "@/domain/plan/schema";

const NONE_VALUE = "__none__";

interface MaterialSelectProps {
  label: string;
  materials: Material[];
  kinds: MaterialKind[];
  value: string | null;
  onChange: (materialId: string | null) => void;
  allowNone?: boolean;
}

export const MaterialSwatch = ({ color }: { color: string }) => (
  <span className="inline-block size-3.5 shrink-0 rounded-sm border border-black/10" style={{ backgroundColor: color }} aria-hidden />
);

export const MaterialSelect = ({ label, materials, kinds, value, onChange, allowNone = true }: MaterialSelectProps) => {
  const options = materials.filter((material) => kinds.includes(material.kind));
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value ?? NONE_VALUE} onValueChange={(next) => onChange(next === NONE_VALUE ? null : next)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choisir un matériau" />
        </SelectTrigger>
        <SelectContent>
          {allowNone ? <SelectItem value={NONE_VALUE}>Aucun (par défaut)</SelectItem> : null}
          {options.map((material) => (
            <SelectItem key={material.id} value={material.id}>
              <span className="flex items-center gap-2">
                <MaterialSwatch color={material.color} />
                {material.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
