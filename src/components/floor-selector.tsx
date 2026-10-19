"use client";

import { Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Floor } from "@/domain/plan/schema";
import { cn } from "@/lib/utils";

interface FloorSelectorProps {
  floors: Floor[];
  value: string | null;
  onChange: (floorId: string) => void;
  className?: string;
}

export const FloorSelector = ({ floors, value, onChange, className }: FloorSelectorProps) => (
  <Select value={value ?? floors[0]?.id} onValueChange={onChange}>
    <SelectTrigger className={cn("w-44 bg-background", className)} aria-label="Étage">
      <Layers className="size-4 text-muted-foreground" aria-hidden />
      <SelectValue placeholder="Étage" />
    </SelectTrigger>
    <SelectContent>
      {floors.map((floor) => (
        <SelectItem key={floor.id} value={floor.id}>
          {floor.name}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
