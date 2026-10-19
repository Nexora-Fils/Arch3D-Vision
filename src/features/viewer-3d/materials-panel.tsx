"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Material, Plan } from "@/domain/plan/schema";
import { PHOTO_TEXTURES } from "@/features/viewer-3d/photo-textures";
import { photoForMaterial } from "@/features/viewer-3d/textures";
import { cn } from "@/lib/utils";
import { usePlanStore } from "@/store/plan-store";

type CategoryKey = "walls" | "floors" | "roof" | "wood" | "metal" | "stone";

const WOOD_TONES = ["#a0683f", "#c08a5a", "#7a4f2e", "#d9b48a", "#5c3b24"];
const METAL_TONES = ["#2b2f36", "#5b6068", "#9ea3a8", "#e4e4e2", "#7a5c3c"];
const STONE_TONES = ["#cbbca3", "#b8ab95", "#d8cfbf", "#9d9484", "#e2d8c6"];

const textureStyle = (material: Material) => ({
  backgroundColor: material.color,
  backgroundImage: `url(/textures/${PHOTO_TEXTURES[photoForMaterial(material)].dir}/diff.jpg)`,
  backgroundSize: "220%",
  backgroundBlendMode: "multiply" as const,
});

const Swatch = ({ isSelected, onClick, label, style }: { isSelected: boolean; onClick: () => void; label: string; style: React.CSSProperties }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-pressed={isSelected}
    title={label}
    className={cn("size-9 rounded-md border-2 shadow-sm transition-transform hover:scale-105", isSelected ? "border-electric" : "border-white/15")}
    style={style}
  />
);

/** Mockup « Matériaux » panel: one row per category, each opening real, applicable choices. */
export const MaterialsPanel = ({ plan }: { plan: Plan }) => {
  const [open, setOpen] = useState<CategoryKey | null>("walls");
  const { updateSettings, updateRoom, updateMaterial } = usePlanStore.getState();
  const rooms = plan.floors.flatMap((floor) => floor.rooms.map((room) => ({ room, floor })));
  const [roomId, setRoomId] = useState<string | null>(rooms[0]?.room.id ?? null);
  const selectedRoom = rooms.find((entry) => entry.room.id === roomId) ?? rooms[0];
  const byKind = (...kinds: Material["kind"][]) => plan.materials.filter((material) => kinds.includes(material.kind));
  const facade = plan.materials.find((material) => material.id === plan.settings.exteriorMaterialId);
  const roof = plan.materials.find((material) => material.id === plan.settings.roofMaterialId);
  const wood = plan.materials.find((material) => material.kind === "exterior" && photoForMaterial(material) === "cladding");
  const stone = plan.materials.find((material) => material.kind === "exterior" && photoForMaterial(material) === "sandstone");
  const floorMaterial = plan.materials.find((material) => material.id === selectedRoom?.room.floorMaterialId);

  const categories: { key: CategoryKey; label: string; preview: React.CSSProperties; content: React.ReactNode }[] = [
    {
      key: "walls",
      label: "Murs",
      preview: facade ? textureStyle(facade) : { backgroundColor: "#f1f0ec" },
      content: (
        <div className="flex flex-wrap gap-2">
          {byKind("exterior").filter((material) => photoForMaterial(material) === "plaster").map((material) => (
            <Swatch key={material.id} label={material.name} isSelected={material.id === plan.settings.exteriorMaterialId} onClick={() => updateSettings({ exteriorMaterialId: material.id })} style={textureStyle(material)} />
          ))}
        </div>
      ),
    },
    {
      key: "floors",
      label: "Sols",
      preview: floorMaterial ? textureStyle(floorMaterial) : { backgroundColor: "#b98a5a" },
      content: (
        <div className="grid gap-2">
          <Select value={selectedRoom?.room.id} onValueChange={setRoomId}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rooms.map(({ room, floor }) => (
                <SelectItem key={room.id} value={room.id}>
                  {plan.floors.length > 1 ? `${room.name} · ${floor.name}` : room.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            {byKind("floor").map((material) => (
              <Swatch
                key={material.id}
                label={material.name}
                isSelected={material.id === selectedRoom?.room.floorMaterialId}
                onClick={() => selectedRoom && updateRoom(selectedRoom.floor.id, selectedRoom.room.id, { floorMaterialId: material.id })}
                style={textureStyle(material)}
              />
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "roof",
      label: "Toiture",
      preview: roof ? textureStyle(roof) : { backgroundColor: "#505a6b" },
      content: (
        <div className="flex flex-wrap gap-2">
          {byKind("roof").map((material) => (
            <Swatch key={material.id} label={material.name} isSelected={material.id === plan.settings.roofMaterialId} onClick={() => updateSettings({ roofMaterialId: material.id })} style={textureStyle(material)} />
          ))}
        </div>
      ),
    },
    {
      key: "wood",
      label: "Bois",
      preview: wood ? textureStyle(wood) : { backgroundColor: "#a0683f" },
      content: wood ? (
        <div className="flex flex-wrap gap-2">
          {WOOD_TONES.map((tone) => (
            <Swatch key={tone} label={`Bardage ${tone}`} isSelected={wood.color === tone} onClick={() => updateMaterial(wood.id, { color: tone })} style={textureStyle({ ...wood, color: tone })} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Aucun bardage bois dans ce projet.</p>
      ),
    },
    {
      key: "metal",
      label: "Métal",
      preview: { backgroundColor: plan.settings.frameColor },
      content: (
        <div className="grid gap-2">
          <p className="text-xs text-muted-foreground">Menuiseries des portes et fenêtres.</p>
          <div className="flex flex-wrap gap-2">
            {METAL_TONES.map((tone) => (
              <Swatch key={tone} label={`Menuiseries ${tone}`} isSelected={plan.settings.frameColor === tone} onClick={() => updateSettings({ frameColor: tone })} style={{ backgroundColor: tone }} />
            ))}
          </div>
        </div>
      ),
    },
    {
      key: "stone",
      label: "Pierre",
      preview: stone ? textureStyle(stone) : { backgroundColor: "#cbbca3" },
      content: stone ? (
        <div className="flex flex-wrap gap-2">
          {STONE_TONES.map((tone) => (
            <Swatch key={tone} label={`Pierre ${tone}`} isSelected={stone.color === tone} onClick={() => updateMaterial(stone.id, { color: tone })} style={textureStyle({ ...stone, color: tone })} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Aucun parement pierre dans ce projet.</p>
      ),
    },
  ];

  return (
    <div className="flex flex-col">
      {categories.map((category) => {
        const isOpen = open === category.key;
        return (
          <div key={category.key} className="border-b border-white/10 last:border-0">
            <button type="button" onClick={() => setOpen(isOpen ? null : category.key)} aria-expanded={isOpen} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-white/5">
              <span className="size-7 shrink-0 rounded-full border border-white/20 shadow-inner" style={category.preview} aria-hidden />
              <span className="flex-1 font-medium">{category.label}</span>
              <ChevronDown className={cn("size-4 text-white/50 transition-transform", isOpen && "rotate-180")} aria-hidden />
            </button>
            {isOpen ? (
              <div className="px-3 pb-3">
                <Label className="sr-only">{category.label}</Label>
                {category.content}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};
