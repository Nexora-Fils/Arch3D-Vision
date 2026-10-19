"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  className?: string;
}

const formatValue = (value: number): string => String(Math.round(value * 1000) / 1000);

/** Numeric input that commits on blur or Enter, so typing never floods the undo history. */
export const NumberField = ({ label, value, onChange, min, max, step = 0.1, unit, disabled, className }: NumberFieldProps) => {
  const id = useId();
  const [draft, setDraft] = useState(formatValue(value));
  const [syncedValue, setSyncedValue] = useState(value);
  // Re-derive the draft when the store value changes (undo, drag, other panel).
  if (value !== syncedValue) {
    setSyncedValue(value);
    setDraft(formatValue(value));
  }

  const commit = () => {
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setDraft(formatValue(value));
      return;
    }
    const bounded = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, parsed));
    setDraft(formatValue(bounded));
    if (bounded !== value) onChange(bounded);
  };

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={draft}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          className={unit ? "pr-8" : undefined}
        />
        {unit ? (
          <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-xs text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </div>
    </div>
  );
};
