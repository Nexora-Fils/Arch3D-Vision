"use client";

import { useRef, useState } from "react";
import type { Vec2 } from "@/domain/plan/schema";

interface VirtualJoystickProps {
  onChange: (vector: Vec2) => void;
}

const RADIUS = 56;

/** Touch joystick: the vector is normalised to [-1, 1] on both axes. */
export const VirtualJoystick = ({ onChange }: VirtualJoystickProps) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<Vec2>({ x: 0, y: 0 });
  const activeTouch = useRef<number | null>(null);

  const update = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    const distance = Math.min(RADIUS, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const position = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
    setKnob(position);
    onChange({ x: position.x / RADIUS, y: position.y / RADIUS });
  };

  const reset = () => {
    activeTouch.current = null;
    setKnob({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  };

  return (
    <div
      ref={baseRef}
      data-walk-ui
      className="relative size-36 rounded-full border border-white/40 bg-white/15 backdrop-blur"
      onTouchStart={(event) => {
        event.stopPropagation();
        const touch = event.changedTouches[0];
        activeTouch.current = touch.identifier;
        update(touch.clientX, touch.clientY);
      }}
      onTouchMove={(event) => {
        event.stopPropagation();
        const touch = Array.from(event.changedTouches).find((item) => item.identifier === activeTouch.current);
        if (touch) update(touch.clientX, touch.clientY);
      }}
      onTouchEnd={reset}
      onTouchCancel={reset}
    >
      <div
        className="absolute top-1/2 left-1/2 size-14 rounded-full bg-white/80 shadow-lg"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
};
