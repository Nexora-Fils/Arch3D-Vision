"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { House, LogOut, Maximize, Moon, Mouse, RotateCcw, RotateCw, Sun, TreePine } from "lucide-react";
import { PlanSvg } from "@/components/plan-svg";
import { Skeleton } from "@/components/ui/skeleton";
import { floorBounds, isOutdoorRoom, roomArea, roomCenter } from "@/domain/plan/geometry";
import { previewFromFloor } from "@/domain/plan/preview";
import type { Floor, Lot, Room, Vec2 } from "@/domain/plan/schema";
import { VirtualJoystick } from "@/features/walkthrough/virtual-joystick";
import { useWalkInput } from "@/features/walkthrough/walk-input";
import { useWalkState } from "@/features/walkthrough/walk-state";
import { cn } from "@/lib/utils";
import { usePlanStore } from "@/store/plan-store";
import { useViewerStore } from "@/store/viewer-store";

const WalkCanvas = dynamic(() => import("@/features/walkthrough/walk-canvas").then((module) => module.WalkCanvas), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

/** Start at the back (south) of the largest indoor room, looking north across it, or in the middle of the lot. */
const startPointFor = (rooms: Room[], lot: Lot): Vec2 => {
  const indoor = rooms.filter((room) => !isOutdoorRoom(room));
  if (indoor.length === 0) return { x: lot.width / 2, y: lot.depth / 2 };
  const largest = indoor.reduce((best, room) => (roomArea(room) > roomArea(best) ? room : best), indoor[0]);
  return { x: largest.x + largest.width / 2, y: largest.y + largest.depth * 0.85 };
};

/** A few meters south of the house, facing it. */
const outsidePointFor = (floor: Floor, lot: Lot): Vec2 => {
  const bounds = floorBounds(floor);
  return bounds ? { x: (bounds.minX + bounds.maxX) / 2, y: Math.min(lot.depth + 1, bounds.maxY + 4) } : { x: lot.width / 2, y: lot.depth };
};

const stopClick = (event: React.SyntheticEvent) => event.stopPropagation();

export const Walkthrough = () => {
  const plan = usePlanStore((state) => state.plan);
  const walkFloorId = useViewerStore((state) => state.walkFloorId);
  const setWalkFloor = useViewerStore((state) => state.setWalkFloor);
  const timeOfDay = useViewerStore((state) => state.timeOfDay);
  const toggleTimeOfDay = useViewerStore((state) => state.toggleTimeOfDay);
  const containerRef = useRef<HTMLDivElement>(null);
  const { input, isLocked, isTouchDevice, requestLock, setJoystick, setTurn, pressKey, releaseKey, teleport } = useWalkInput(containerRef);

  const floor = plan?.floors.find((item) => item.id === walkFloorId) ?? plan?.floors[0] ?? null;
  // The visit starts in the main room of the first floor shown; later floor changes come from the stairs or the buttons.
  const [start] = useState(() => (plan && floor ? startPointFor(floor.rooms, plan.lot) : { x: 0, y: 0 }));

  if (!plan || !floor) return null;

  /** Floor buttons jump to the main room of that level, facing north. */
  const goToFloor = (target: Floor) => {
    setWalkFloor(target.id);
    teleport(startPointFor(target.rooms, plan.lot), 0, target.id);
  };

  const goOutside = () => {
    const ground = plan.floors[0];
    setWalkFloor(ground.id);
    teleport(outsidePointFor(ground, plan.lot), 0, ground.id);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  };

  const holdKey = (code: string) => ({
    onPointerDown: () => pressKey(code),
    onPointerUp: () => releaseKey(code),
    onPointerLeave: () => releaseKey(code),
    onPointerCancel: () => releaseKey(code),
  });
  const holdTurn = (direction: number) => ({
    onPointerDown: () => setTurn(direction),
    onPointerUp: () => setTurn(0),
    onPointerLeave: () => setTurn(0),
    onPointerCancel: () => setTurn(0),
  });

  const glass = "border border-white/10 bg-[#0d1830]/85 text-white shadow-xl backdrop-blur-md";
  const moveKeys = [
    { key: "Z", label: "Avancer", code: "KeyW" },
    { key: "S", label: "Reculer", code: "KeyS" },
    { key: "Q", label: "Gauche", code: "KeyA" },
    { key: "D", label: "Droite", code: "KeyD" },
  ];

  return (
    <div ref={containerRef} className="canvas-surface relative h-full bg-[#0d1830]" onClick={requestLock}>
      <div className="absolute inset-0">
        <WalkCanvas plan={plan} floorId={floor.id} start={start} input={input} onFloorChange={setWalkFloor} />
      </div>

      {/* Current room chip and floors, top left. */}
      <div className="pointer-events-none absolute top-3 left-3 flex items-center gap-2">
        <div className={cn("pointer-events-auto flex items-center gap-1 rounded-xl p-1 pr-3", glass)} data-walk-ui onClick={stopClick}>
          <Link href="/dashboard" aria-label="Tableau de bord" className="flex size-8 items-center justify-center rounded-lg bg-electric">
            <House className="size-4" />
          </Link>
          <CurrentRoomName rooms={floor.rooms} />
        </div>
        {plan.floors.length > 1 ? (
          <div className={cn("pointer-events-auto flex items-center gap-1 rounded-xl p-1", glass)} data-walk-ui onClick={stopClick} role="group" aria-label="Étage">
            {plan.floors.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goToFloor(item)}
                aria-pressed={item.id === floor.id}
                className={cn("h-8 rounded-lg px-3 text-xs text-white/80 hover:bg-white/10", item.id === floor.id && "bg-electric text-white hover:bg-electric")}
              >
                {item.level === 0 ? "RDC" : item.name}
              </button>
            ))}
            <button type="button" onClick={goOutside} className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs text-white/80 hover:bg-white/10">
              <TreePine className="size-3.5" />
              Extérieur
            </button>
          </div>
        ) : null}
      </div>

      {/* Leave, top right. */}
      <div className="absolute top-3 right-3" data-walk-ui onClick={stopClick}>
        <Link href={`/projects/${plan.id}/view`} className={cn("flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium hover:bg-[#13213f]", glass)}>
          <LogOut className="size-4 text-amber-400" />
          Quitter la visite
        </Link>
      </div>

      {!isTouchDevice && !isLocked ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={cn("flex max-w-sm flex-col items-center gap-3 rounded-2xl p-6 text-center", glass)}>
            <Mouse className="size-8 text-electric" aria-hidden />
            <p className="font-medium">Cliquez pour commencer la visite</p>
            <p className="text-sm text-white/75">
              Déplacez-vous avec <kbd className="rounded bg-white/15 px-1">Z</kbd> <kbd className="rounded bg-white/15 px-1">Q</kbd> <kbd className="rounded bg-white/15 px-1">S</kbd> <kbd className="rounded bg-white/15 px-1">D</kbd> ou les flèches, regardez avec la souris, courez avec Maj. Échap libère la souris.
            </p>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3">
        {/* Minimap: click a room to go there. */}
        <div className="pointer-events-auto flex items-end gap-3" data-walk-ui onClick={stopClick}>
          <Minimap floor={floor} lot={plan.lot} onRoomSelect={(roomId) => {
            const room = floor.rooms.find((item) => item.id === roomId);
            if (room) teleport(roomCenter(room), undefined, floor.id);
          }} />
          {isTouchDevice ? <VirtualJoystick onChange={setJoystick} /> : null}
        </div>

        {/* Movement keys, bottom center. */}
        <div className={cn("pointer-events-auto flex items-center gap-1 rounded-xl p-1", glass)} data-walk-ui onClick={stopClick}>
          {moveKeys.map(({ key, label, code }) => (
            <button key={code} type="button" {...holdKey(code)} className="flex h-9 select-none items-center gap-2 rounded-lg px-2.5 text-sm text-white/85 hover:bg-white/10 active:bg-electric">
              <kbd className="flex size-5 items-center justify-center rounded border border-white/25 text-[11px] font-semibold">{key}</kbd>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-white/15" />
          <button type="button" {...holdTurn(1)} aria-label="Tourner à gauche" className="flex size-9 items-center justify-center rounded-lg hover:bg-white/10 active:bg-electric">
            <RotateCcw className="size-4" />
          </button>
          <button type="button" {...holdTurn(-1)} aria-label="Tourner à droite" className="flex size-9 items-center justify-center rounded-lg hover:bg-white/10 active:bg-electric">
            <RotateCw className="size-4" />
          </button>
        </div>

        {/* Day / evening and full screen, bottom right. */}
        <div className={cn("pointer-events-auto flex items-center gap-1 rounded-xl p-1", glass)} data-walk-ui onClick={stopClick}>
          <button type="button" onClick={toggleFullscreen} aria-label="Plein écran" className="flex size-9 items-center justify-center rounded-lg hover:bg-white/10">
            <Maximize className="size-4" />
          </button>
          {(["day", "evening"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => timeOfDay !== value && toggleTimeOfDay()}
              aria-pressed={timeOfDay === value}
              className={cn("flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm text-white/80 hover:bg-white/10", timeOfDay === value && "bg-electric text-white hover:bg-electric")}
            >
              {value === "day" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              {value === "day" ? "Jour" : "Soir"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const CurrentRoomName = ({ rooms }: { rooms: Room[] }) => {
  const roomId = useWalkState((state) => state.roomId);
  const room = rooms.find((item) => item.id === roomId);
  return <span className="px-2 text-sm font-semibold">{room ? room.name : "Extérieur"}</span>;
};

/** Floor plan with the visitor's position and heading. */
const Minimap = ({ floor, lot, onRoomSelect }: { floor: Floor; lot: Lot; onRoomSelect: (roomId: string) => void }) => {
  const position = useWalkState((state) => state.position);
  const yaw = useWalkState((state) => state.yaw);
  const preview = useMemo(() => previewFromFloor(floor, lot), [floor, lot]);
  return (
    <div className="h-32 w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0d1830]/85 p-1.5 shadow-xl backdrop-blur-md">
      <PlanSvg preview={preview} marker={{ position, yaw }} onRoomSelect={onRoomSelect} />
    </div>
  );
};
