"use client";

import { MaterialSelect } from "@/components/material-select";
import { NumberField } from "@/components/number-field";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ROOF_TYPE_LABELS } from "@/domain/plan/labels";
import { ROOF_TYPES, type RoofType } from "@/domain/plan/schema";
import { usePlanStore } from "@/store/plan-store";

/** Roof and facade settings, shared by the settings page and the 3D view panel. */
export const RoofFields = () => {
  const settings = usePlanStore((state) => state.plan?.settings);
  const materials = usePlanStore((state) => state.plan?.materials ?? []);
  const { updateSettings, commit } = usePlanStore.getState();
  if (!settings) return null;

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label className="text-xs text-muted-foreground">Type de toit</Label>
        <Select value={settings.roofType} onValueChange={(roofType) => updateSettings({ roofType: roofType as RoofType })}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROOF_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {ROOF_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Pente du toit</Label>
          <span className="text-xs tabular-nums text-muted-foreground">{settings.roofPitch}°</span>
        </div>
        <Slider
          value={[settings.roofPitch]}
          min={5}
          max={60}
          step={1}
          disabled={settings.roofType === "flat"}
          onValueChange={([roofPitch]) => updateSettings({ roofPitch }, { transient: true })}
          onValueCommit={commit}
          aria-label="Pente du toit"
        />
      </div>
      <NumberField label="Débord de toit" unit="m" min={0} max={2} step={0.05} value={settings.roofOverhang} onChange={(roofOverhang) => updateSettings({ roofOverhang })} />
      <div className="flex items-center justify-between">
        <Label htmlFor="solar-panels" className="text-xs text-muted-foreground">
          Panneaux solaires
        </Label>
        <Switch id="solar-panels" checked={settings.solarPanels} onCheckedChange={(solarPanels) => updateSettings({ solarPanels })} />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="shutters" className="text-xs text-muted-foreground">
          Volets et encadrements
        </Label>
        <Switch id="shutters" checked={settings.shutters} onCheckedChange={(shutters) => updateSettings({ shutters })} />
      </div>
      <MaterialSelect label="Matériau de toiture" materials={materials} kinds={["roof"]} value={settings.roofMaterialId} onChange={(roofMaterialId) => updateSettings({ roofMaterialId })} />
      <MaterialSelect label="Matériau de façade" materials={materials} kinds={["exterior", "wall"]} value={settings.exteriorMaterialId} onChange={(exteriorMaterialId) => updateSettings({ exteriorMaterialId })} />
    </div>
  );
};
