"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { clamp, findRoomAt } from "@/domain/plan/geometry";
import type { Plan, Vec2 } from "@/domain/plan/schema";
import { createWalkWorld, moveVisitor, spawnVisitor, visibleFloorIndex, visitorElevation } from "@/domain/plan/walk";
import { EYE_HEIGHT, toScene } from "@/features/viewer-3d/convert";
import type { WalkInput } from "@/features/walkthrough/walk-input";
import { useWalkState } from "@/features/walkthrough/walk-state";

interface FirstPersonControllerProps {
  plan: Plan;
  /** Floor the visit starts on. */
  floorId: string;
  start: Vec2;
  input: WalkInput;
  /** Called when the visitor reaches another level by the stairs. */
  onFloorChange: (floorId: string) => void;
}

const WALK_SPEED = 2.4;
const RUN_SPEED = 4.2;
const BODY_RADIUS = 0.28;
const LOOK_SENSITIVITY = 0.0022;
/** Radians per second for the on-screen turn buttons. */
const TURN_RATE = 1.6;
const MAX_PITCH = 1.35;
const LOT_MARGIN = 2;
/** How fast the eye follows the steps (1/s): smooths the climb without lag. */
const EYE_FOLLOW = 14;

const hasAny = (keys: ReadonlySet<string>, codes: string[]) => codes.some((code) => keys.has(code));

/**
 * Walks the visitor through the house: movement is computed in plan meters
 * by the domain walk model (walls, door spans, stair flights and stairwell
 * guards), then converted to scene coordinates for the camera. Climbing a
 * flight raises the eye step by step and lands on the next level.
 */
export const FirstPersonController = ({ plan, floorId, start, input, onFloorChange }: FirstPersonControllerProps) => {
  const camera = useThree((state) => state.camera);
  const world = useMemo(() => createWalkWorld(plan), [plan]);
  const indexOf = (id: string) => Math.max(0, plan.floors.findIndex((floor) => floor.id === id));
  const state = useRef({
    visitor: spawnVisitor(world, indexOf(floorId), start),
    yaw: 0,
    pitch: 0,
    frame: 0,
    velocity: { x: 0, y: 0 },
    eyeY: null as number | null,
    reportedFloorId: floorId,
  });

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const current = state.current;

    const teleportTarget = input.consumeTeleport();
    if (teleportTarget) {
      current.visitor = spawnVisitor(world, teleportTarget.floorId ? indexOf(teleportTarget.floorId) : current.visitor.floorIndex, teleportTarget.position);
      if (teleportTarget.yaw !== undefined) current.yaw = teleportTarget.yaw;
      current.velocity = { x: 0, y: 0 };
      current.eyeY = null;
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
      const { position } = current.visitor;
      const target = {
        x: clamp(position.x + current.velocity.x * dt, -LOT_MARGIN, plan.lot.width + LOT_MARGIN),
        y: clamp(position.y + current.velocity.y * dt, -LOT_MARGIN, plan.lot.depth + LOT_MARGIN),
      };
      current.visitor = moveVisitor(world, current.visitor, target, BODY_RADIUS);
    }

    const eyeTarget = visitorElevation(world, current.visitor) + EYE_HEIGHT;
    current.eyeY = current.eyeY === null ? eyeTarget : current.eyeY + (eyeTarget - current.eyeY) * Math.min(1, dt * EYE_FOLLOW);
    const [x, z] = toScene(current.visitor.position, plan.lot);
    camera.position.set(x, current.eyeY, z);
    camera.rotation.set(current.pitch, current.yaw, 0, "YXZ");

    current.frame += 1;
    if (current.frame % 6 === 0) {
      const shown = plan.floors[visibleFloorIndex(world, current.visitor)];
      if (!shown) return;
      useWalkState.getState().update(current.visitor.position, current.yaw, findRoomAt(shown, current.visitor.position)?.id ?? null);
      if (shown.id !== current.reportedFloorId) {
        current.reportedFloorId = shown.id;
        onFloorChange(shown.id);
      }
    }
  });

  return null;
};
