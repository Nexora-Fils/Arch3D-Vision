import { describe, expect, it } from "vitest";
import { alignAndSnapWallEndpoint, snapPointToWalls } from "../canvas-utils";
import type { Wall } from "@/domain/plan/schema";

const wall: Wall = {
  id: "wall",
  roomId: null,
  side: null,
  start: { x: 1, y: 2 },
  end: { x: 5, y: 2 },
  thickness: 0.15,
  height: 2.7,
  materialId: null,
};

describe("snapPointToWalls", () => {
  it("projects a nearby point onto the closest wall", () => {
    expect(snapPointToWalls({ x: 3.2, y: 2.08 }, [wall], 0.1)).toEqual({ x: 3.2, y: 2 });
  });

  it("leaves points beyond the snap tolerance unchanged", () => {
    const point = { x: 3.2, y: 2.2 };
    expect(snapPointToWalls(point, [wall], 0.1)).toBe(point);
  });
});

describe("alignAndSnapWallEndpoint", () => {
  it("keeps an endpoint on a lower-floor wall after axis alignment", () => {
    const start = { x: 0, y: 1.9 };
    const point = { x: 3, y: 2.04 };
    expect(alignAndSnapWallEndpoint(start, point, [wall], 0.15)).toEqual({ x: 3, y: 2 });
  });
});
