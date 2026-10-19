import type { PlanPreview } from "@/domain/plan/preview";
import { ROOM_TYPE_COLORS } from "@/domain/plan/labels";
import type { Vec2 } from "@/domain/plan/schema";
import { cn } from "@/lib/utils";

interface PlanSvgProps {
  preview: PlanPreview;
  /** Visitor position and heading (plan meters / radians) for the minimap. */
  marker?: { position: Vec2; yaw: number } | null;
  showLabels?: boolean;
  className?: string;
  /** Makes rooms clickable (walkthrough minimap: go to the room). */
  onRoomSelect?: (roomId: string) => void;
}

/** Floor plan drawn in SVG straight from plan meters; works on the server. */
export const PlanSvg = ({ preview, marker, showLabels = false, className, onRoomSelect }: PlanSvgProps) => {
  const { lot, rooms, walls } = preview;
  const margin = Math.max(lot.width, lot.depth) * 0.04;
  const heading = marker ? { x: -Math.sin(marker.yaw), y: -Math.cos(marker.yaw) } : null;
  return (
    <svg
      viewBox={`${-margin} ${-margin} ${lot.width + margin * 2} ${lot.depth + margin * 2}`}
      className={cn("block h-full w-full", className)}
      role="img"
      aria-label="Plan de la maison"
    >
      <rect x={0} y={0} width={lot.width} height={lot.depth} fill="#e6f0dc" stroke="#9bb886" strokeWidth={0.08} />
      {rooms.map((room) => (
        <g key={room.id}>
          <rect
            x={room.x}
            y={room.y}
            width={room.width}
            height={room.depth}
            fill={ROOM_TYPE_COLORS[room.type]}
            onClick={onRoomSelect ? () => onRoomSelect(room.id) : undefined}
            className={onRoomSelect ? "cursor-pointer hover:opacity-70" : undefined}
          >
            {onRoomSelect ? <title>{`Aller dans : ${room.name}`}</title> : null}
          </rect>
          {showLabels && room.width > 1.8 && room.depth > 1 ? (
            <text x={room.x + room.width / 2} y={room.y + room.depth / 2} fontSize={Math.min(0.5, room.width / 6)} textAnchor="middle" dominantBaseline="middle" fill="#1e293b">
              {room.name}
            </text>
          ) : null}
        </g>
      ))}
      {walls.map((wall) => (
        <line key={wall.id} x1={wall.start.x} y1={wall.start.y} x2={wall.end.x} y2={wall.end.y} stroke="#1f2937" strokeWidth={wall.thickness} strokeLinecap="square" />
      ))}
      {marker && heading ? (
        <g>
          <line x1={marker.position.x} y1={marker.position.y} x2={marker.position.x + heading.x * 1.2} y2={marker.position.y + heading.y * 1.2} stroke="#2563eb" strokeWidth={0.12} strokeLinecap="round" />
          <circle cx={marker.position.x} cy={marker.position.y} r={0.35} fill="#2563eb" stroke="#ffffff" strokeWidth={0.1} />
        </g>
      ) : null}
    </svg>
  );
};
