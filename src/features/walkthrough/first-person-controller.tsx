"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { buildSolidSegments, buildWallSegments, clamp, findRoomAt, resolveCollisions } from "@/domain/plan/geometry";
import type { Floor, Lot, Vec2 } from "@/domain/plan/schema";
import { EYE_HEIGHT, toScene } from "@/features/viewer-3d/convert";
import type { WalkInput } from "@/features/walkthrough/walk-input";
import { useWalkState } from "@/features/walkthrough/walk-state";

interface FirstPersonControllerProps {
  floor: Floor;
  base: number;
  lot: Lot;
  start: Vec2;
  input: WalkInput;
}

const WALK_SPEED = 2.4;
const RUN_SPEED = 4.2;
const BODY_RADIUS = 0.28;
const LOOK_SENSITIVITY = 0.0022;
/** Radians per second for the on-screen turn buttons. */
const TURN_RATE = 1.6;
const MAX_PITCH = 1.35;
const LOT_MARGIN = 2;

const hasAny = (keys: ReadonlySet<string>, codes: string[]) => codes.some((code) => keys.has(code));

/**
 * Walks the visitor through the plan: movement is computed in plan meters,
 * resolved against the merged wall segments (door spans excluded), then
 * converted to scene coordinates for the camera.
 */
export const FirstPersonController = ({ floor, base, lot, start, input }: FirstPersonControllerProps) => {
  const camera = useThree((state) => state.camera);
  const state = useRef({ position: start, yaw: 0, pitch: 0, frame: 0, velocity: { x: 0, y: 0 } });
  const solids = useMemo(() => buildSolidSegments(buildWallSegments(floor)), [floor]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const current = state.current;

    const teleportTarget = input.consumeTeleport();
    if (teleportTarget) {
      current.position = teleportTarget.position;
      if (teleportTarget.yaw !== undefined) current.yaw = teleportTarget.yaw;
    }

    const look = input.consumeLook();
    current.yaw -= look.x * LOOK_SENSITIVITY;
    current.yaw += input.readTurn() * TURN_RATE * dt;
    current.pitch = clamp(current.pitch - look.y * LOOK_SENSITIVITY, -MAX_PITCH, MAX_PITCH);

    const keys = input.readKeys();
    const joystick = input.readJoystick();
    const forwardInput = (hasAny(keys, ["KeyW", "ArrowUp"]) ? 1 : 0) - (hasAny(keys, ["KeyS", "ArrowDown"]) ? 1 : 0) - joystick.y;
    const strafeInput = (hasAny(keys, ["KeyD", "ArrowRight"]) ? 1 : 0) - (hasAny(keys, ["KeyA", "ArrowLeft"]) ? 1 : 0) + joystick.x;
    const magnitude = Math.hypot(forwardInput, strafeInput);

    // Smooth acceleration and braking: the target velocity is reached in ~0.15 s.
    const speed = hasAny(keys, ["ShiftLeft", "ShiftRight"]) ? RUN_SPEED : WALK_SPEED;
    const forward = { x: -Math.sin(current.yaw), y: -Math.cos(current.yaw) };
    const right = { x: Math.cos(current.yaw), y: -Math.sin(current.yaw) };
    const scale = magnitude > 0.01 ? (Math.min(1, magnitude) / magnitude) * speed : 0;
    const targetVelocity = {
      x: (forward.x * forwardInput + right.x * strafeInput) * scale,
      y: (forward.y * forwardInput + right.y * strafeInput) * scale,
    };
    const blend = Math.min(1, dt * 9);
    current.velocity = {
      x: current.velocity.x + (targetVelocity.x - current.velocity.x) * blend,
      y: current.velocity.y + (targetVelocity.y - current.velocity.y) * blend,
    };
    if (Math.hypot(current.velocity.x, current.velocity.y) > 0.005) {
      const next = { x: current.position.x + current.velocity.x * dt, y: current.position.y + current.velocity.y * dt };
      const resolved = resolveCollisions(next, solids, BODY_RADIUS);
      current.position = {
        x: clamp(resolved.x, -LOT_MARGIN, lot.width + LOT_MARGIN),
        y: clamp(resolved.y, -LOT_MARGIN, lot.depth + LOT_MARGIN),
      };
    }

    const [x, z] = toScene(current.position, lot);
    camera.position.set(x, base + EYE_HEIGHT, z);
    camera.rotation.set(current.pitch, current.yaw, 0, "YXZ");

    current.frame += 1;
    if (current.frame % 6 === 0) {
      useWalkState.getState().update(current.position, current.yaw, findRoomAt(floor, current.position)?.id ?? null);
    }
  });

  return null;
};
