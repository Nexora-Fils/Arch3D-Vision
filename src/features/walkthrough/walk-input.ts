"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import type { Vec2 } from "@/domain/plan/schema";
import { useMediaQuery } from "@/lib/hooks/use-media-query";

export interface TeleportTarget {
  position: Vec2;
  /** Optional heading in radians. */
  yaw?: number;
  /** Floor to stand on after the jump (defaults to the current one). */
  floorId?: string;
}

interface WalkInputState {
  keys: Set<string>;
  joystick: Vec2;
  lookDelta: Vec2;
  /** -1 (right) … +1 (left) from the on-screen turn buttons. */
  turn: number;
  teleport: TeleportTarget | null;
}

/** Read-side of the input, consumed by the controller every frame without React re-renders. */
export interface WalkInput {
  readKeys: () => ReadonlySet<string>;
  readJoystick: () => Vec2;
  readTurn: () => number;
  /** Returns the accumulated look delta and resets it. */
  consumeLook: () => Vec2;
  /** Returns the pending teleport target (if any) and clears it. */
  consumeTeleport: () => TeleportTarget | null;
}

const createState = (): WalkInputState => ({ keys: new Set(), joystick: { x: 0, y: 0 }, lookDelta: { x: 0, y: 0 }, turn: 0, teleport: null });

const createReader = (state: WalkInputState): WalkInput => ({
  readKeys: () => state.keys,
  readJoystick: () => state.joystick,
  readTurn: () => state.turn,
  consumeLook: () => {
    const delta = state.lookDelta;
    state.lookDelta = { x: 0, y: 0 };
    return delta;
  },
  consumeTeleport: () => {
    const target = state.teleport;
    state.teleport = null;
    return target;
  },
});

const COARSE_POINTER_QUERY = "(pointer: coarse)";

const LOOK_SENSITIVITY_TOUCH = 2.2;

/**
 * Binds keyboard, pointer-lock mouse look and touch look to a container.
 * Touches that start on an element marked `data-walk-ui` are left alone so
 * the on-screen joystick and buttons keep working.
 */
export const useWalkInput = (containerRef: RefObject<HTMLDivElement | null>) => {
  // Stable mutable input state, created once; mutated from event listeners, read by the controller.
  const [{ state: inputState, reader: input, writer }] = useState(() => {
    const state = createState();
    return {
      state,
      reader: createReader(state),
      writer: {
        setJoystick: (vector: Vec2) => {
          state.joystick = vector;
        },
        setTurn: (direction: number) => {
          state.turn = direction;
        },
        pressKey: (code: string) => {
          state.keys.add(code);
        },
        releaseKey: (code: string) => {
          state.keys.delete(code);
        },
        teleport: (position: Vec2, yaw?: number, floorId?: string) => {
          state.teleport = { position, yaw, floorId };
        },
      },
    };
  });
  const [isLocked, setLocked] = useState(false);
  const isTouchDevice = useMediaQuery(COARSE_POINTER_QUERY);

  useEffect(() => {
    const input = inputState;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      input.keys.add(event.code);
      if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => input.keys.delete(event.code);
    const onBlur = () => input.keys.clear();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [inputState]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const input = inputState;

    const onPointerLockChange = () => setLocked(document.pointerLockElement === element);
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== element) return;
      input.lookDelta.x += event.movementX;
      input.lookDelta.y += event.movementY;
    };

    let lookTouchId: number | null = null;
    let lastTouch: Vec2 | null = null;
    const isUiTarget = (target: EventTarget | null) => target instanceof Element && target.closest("[data-walk-ui]") !== null;
    const onTouchStart = (event: TouchEvent) => {
      if (lookTouchId !== null) return;
      for (const touch of Array.from(event.changedTouches)) {
        if (isUiTarget(touch.target)) continue;
        lookTouchId = touch.identifier;
        lastTouch = { x: touch.clientX, y: touch.clientY };
        break;
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (lookTouchId === null || !lastTouch) return;
      const touch = Array.from(event.changedTouches).find((item) => item.identifier === lookTouchId);
      if (!touch) return;
      event.preventDefault();
      input.lookDelta.x += (touch.clientX - lastTouch.x) * LOOK_SENSITIVITY_TOUCH;
      input.lookDelta.y += (touch.clientY - lastTouch.y) * LOOK_SENSITIVITY_TOUCH;
      lastTouch = { x: touch.clientX, y: touch.clientY };
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (Array.from(event.changedTouches).some((item) => item.identifier === lookTouchId)) {
        lookTouchId = null;
        lastTouch = null;
      }
    };

    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onMouseMove);
    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    element.addEventListener("touchend", onTouchEnd);
    element.addEventListener("touchcancel", onTouchEnd);
    return () => {
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", onTouchEnd);
      element.removeEventListener("touchcancel", onTouchEnd);
      if (document.pointerLockElement === element) document.exitPointerLock();
    };
  }, [containerRef, inputState]);

  const requestLock = useCallback(() => {
    const element = containerRef.current;
    if (!element || isTouchDevice) return;
    element.requestPointerLock?.();
  }, [containerRef, isTouchDevice]);

  return { input, isLocked, isTouchDevice, requestLock, ...writer };
};
