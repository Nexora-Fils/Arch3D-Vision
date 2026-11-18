"use client";

import type { ComponentProps } from "react";
import { Group } from "react-konva";
import { indoorBounds } from "@/domain/plan/geometry";
import { ROOM_TYPE_LABELS } from "@/domain/plan/labels";
import type { Floor } from "@/domain/plan/schema";
import { HouseDimensions } from "@/features/editor-2d/canvas/house-dimensions";
import { RoomLabel, RoomShape } from "@/features/editor-2d/canvas/room-shape";
import { WallShape } from "@/features/editor-2d/canvas/wall-shape";

interface LowerFloorUnderlayProps {
  lowerFloor: Floor;
  gridStep: number;
  showDimensions: boolean;
  floorColorFor: (materialId: string | null) => string | undefined;
  floorPatternFor: (materialId: string | null) => ComponentProps<typeof RoomShape>["floorPattern"];
}

/** The level below, faded under the edited floor so its walls can be traced over. */
export const LowerFloorUnderlay = ({
  lowerFloor,
  gridStep,
  showDimensions,
  floorColorFor,
  floorPatternFor,
}: LowerFloorUnderlayProps) => {
  const lowerFloorBounds = indoorBounds(lowerFloor);
  return (
    <Group opacity={0.28} listening={false}>
      {lowerFloor.rooms.map((room) => (
        <RoomShape
          key={`underlay-room-${room.id}`}
          room={room}
          floorId={lowerFloor.id}
          gridStep={gridStep}
          isSelected={false}
          isInteractive={false}
          showDimensions={false}
          floorColor={floorColorFor(room.floorMaterialId)}
          floorPattern={floorPatternFor(room.floorMaterialId)}
        />
      ))}
      {lowerFloor.walls.map((wall) => (
        <WallShape
          key={`underlay-wall-${wall.id}`}
          wall={wall}
          floorId={lowerFloor.id}
          gridStep={gridStep}
          isSelected={false}
          isInteractive={false}
        />
      ))}
      {lowerFloor.rooms.map((room) => (
        <RoomLabel
          key={`underlay-label-${room.id}`}
          room={room}
          showDimensions={showDimensions}
          typeLabel={ROOM_TYPE_LABELS[room.type]}
        />
      ))}
      {showDimensions && lowerFloorBounds ? <HouseDimensions bounds={lowerFloorBounds} /> : null}
    </Group>
  );
};
