"use client";

import type { KonvaEventObject } from "konva/lib/Node";
import { Group, Line, Rect, Text } from "react-konva";
import { formatArea, formatMeters, roomArea, snapToGrid } from "@/domain/plan/geometry";
import { ROOM_TYPE_COLORS } from "@/domain/plan/labels";
import type { Room } from "@/domain/plan/schema";
import { LABEL_COLOR, LABEL_FONT, SELECTION_COLOR } from "@/features/editor-2d/canvas-utils";
import { useEditorStore } from "@/store/editor-store";
import { usePlanStore } from "@/store/plan-store";

interface RoomShapeProps {
  room: Room;
  floorId: string;
  gridStep: number;
  isSelected: boolean;
  isInteractive: boolean;
  showDimensions: boolean;
  floorColor?: string;
  /** Photographic floor texture, scaled to real-world size. */
  floorPattern?: { image: HTMLImageElement; scale: { x: number; y: number } };
}

const LABEL_SIZE = 0.32;

interface RoomLabelProps {
  room: Room;
  showDimensions: boolean;
  typeLabel: string;
}

/** Name, dimensions and area, drawn in a layer above the furniture so they always stay readable. */
export const RoomLabel = ({ room, showDimensions, typeLabel }: RoomLabelProps) => {
  if (room.width <= 1.6 || room.depth <= 1.2) return null;
  const lines = [room.name, showDimensions ? `${formatMeters(room.width)} × ${formatMeters(room.depth)}` : typeLabel, formatArea(roomArea(room))];
  const labelHeight = lines.length * LABEL_SIZE * 1.25;
  const labelWidth = Math.min(room.width - 0.2, 3.2);
  return (
    <Group x={room.x} y={room.y} listening={false}>
      <Rect x={room.width / 2 - labelWidth / 2} y={room.depth / 2 - labelHeight / 2 - 0.08} width={labelWidth} height={labelHeight + 0.16} fill="rgba(255, 255, 255, 0.78)" cornerRadius={0.08} />
      <Text x={0} y={room.depth / 2 - labelHeight / 2} width={room.width} align="center" text={lines.join("\n")} fontSize={LABEL_SIZE} fontFamily={LABEL_FONT} lineHeight={1.25} fill={LABEL_COLOR} fontStyle="500" />
    </Group>
  );
};

export const RoomShape = ({ room, floorId, gridStep, isSelected, isInteractive, showDimensions, floorColor, floorPattern }: RoomShapeProps) => {
  const { moveRoom, commit } = usePlanStore.getState();
  const { select } = useEditorStore.getState();

  const handleSelect = (event: KonvaEventObject<Event>) => {
    event.cancelBubble = true;
    select({ kind: "room", id: room.id });
  };

  const handleDragMove = (event: KonvaEventObject<DragEvent>) => {
    const node = event.target;
    const x = snapToGrid(node.x(), gridStep);
    const y = snapToGrid(node.y(), gridStep);
    node.position({ x, y });
    if (x !== room.x || y !== room.y) {
      moveRoom(floorId, room.id, { x: x - room.x, y: y - room.y }, { transient: true });
    }
  };


  return (
    <Group
      x={room.x}
      y={room.y}
      listening={isInteractive}
      draggable={isInteractive}
      onClick={handleSelect}
      onTap={handleSelect}
      onDragStart={handleSelect}
      onDragMove={handleDragMove}
      onDragEnd={commit}
    >
      <Rect
        width={room.width}
        height={room.depth}
        fill={floorPattern ? undefined : ROOM_TYPE_COLORS[room.type]}
        fillPatternImage={floorPattern?.image}
        fillPatternScale={floorPattern?.scale}
        fillPatternRepeat="repeat"
        stroke={isSelected ? SELECTION_COLOR : "rgba(30, 41, 59, 0.18)"}
        strokeWidth={isSelected ? 2.5 : 1}
        strokeScaleEnabled={false}
        shadowColor={SELECTION_COLOR}
        shadowBlur={isSelected ? 18 : 0}
        shadowOpacity={isSelected ? 0.35 : 0}
        shadowEnabled={isSelected}
      />
      {floorPattern ? <Rect width={room.width} height={room.depth} fill="#ffffff" opacity={0.32} listening={false} /> : null}
      {floorColor && !floorPattern ? <Rect x={0.08} y={0.08} width={Math.max(0, room.width - 0.16)} height={Math.max(0, room.depth - 0.16)} fill={floorColor} opacity={0.18} listening={false} /> : null}
      {isSelected && showDimensions ? (
        <>
          <Line points={[0, -0.35, room.width, -0.35]} stroke={SELECTION_COLOR} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
          <Line points={[0, -0.5, 0, -0.2]} stroke={SELECTION_COLOR} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
          <Line points={[room.width, -0.5, room.width, -0.2]} stroke={SELECTION_COLOR} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
          <Text x={0} y={-0.75} width={room.width} align="center" text={formatMeters(room.width)} fontSize={0.26} fontFamily={LABEL_FONT} fill={SELECTION_COLOR} listening={false} />
          <Line points={[-0.35, 0, -0.35, room.depth]} stroke={SELECTION_COLOR} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
          <Line points={[-0.5, 0, -0.2, 0]} stroke={SELECTION_COLOR} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
          <Line points={[-0.5, room.depth, -0.2, room.depth]} stroke={SELECTION_COLOR} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
          <Text x={-0.45} y={room.depth / 2} rotation={-90} width={room.depth} offsetX={room.depth / 2} align="center" text={formatMeters(room.depth)} fontSize={0.26} fontFamily={LABEL_FONT} fill={SELECTION_COLOR} listening={false} />
        </>
      ) : null}
    </Group>
  );
};
