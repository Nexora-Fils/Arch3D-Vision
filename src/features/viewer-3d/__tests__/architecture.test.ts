import { Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { mergeBoxes } from "../architecture/merged-boxes";
import { createMetricBox } from "../architecture/metric-box";
import { createRandom, ellipsoidCards, hedgeCards, packCards } from "../landscape/foliage";

const uvRange = (values: number[]) => Math.max(...values) - Math.min(...values);

describe("metric boxes", () => {
  it("express UVs in meters on every face", () => {
    const box = createMetricBox(4, 2.5, 0.3);
    const uv = box.getAttribute("uv");
    const face = (index: number) => {
      const us: number[] = [];
      const vs: number[] = [];
      for (let vertex = index * 4; vertex < index * 4 + 4; vertex += 1) {
        us.push(uv.getX(vertex));
        vs.push(uv.getY(vertex));
      }
      return [uvRange(us), uvRange(vs)];
    };
    // +x face: depth × height; +y face: width × depth; +z face: width × height.
    const expected: [number, [number, number]][] = [
      [0, [0.3, 2.5]],
      [2, [4, 0.3]],
      [4, [4, 2.5]],
    ];
    for (const [index, [u, v]] of expected) {
      expect(face(index)[0]).toBeCloseTo(u);
      expect(face(index)[1]).toBeCloseTo(v);
    }
  });

  it("merge many parts into one geometry placed in their frame", () => {
    const merged = mergeBoxes([
      { size: [1, 1, 1], position: [0, 0, 0] },
      { size: [1, 1, 1], position: [5, 0, 0] },
    ]);
    expect(merged).not.toBeNull();
    merged?.computeBoundingBox();
    expect(merged?.getAttribute("position").count).toBe(48);
    expect(merged?.boundingBox?.max.x).toBeCloseTo(5.5);
    expect(mergeBoxes([])).toBeNull();
  });
});

describe("foliage cards", () => {
  it("cover a hedge with a density proportional to its visible surface, deterministically", () => {
    const half = new Vector3(5, 0.5, 0.35);
    const first = hedgeCards(new Vector3(), half, 50, [0.3, 0.4], createRandom(3));
    const second = hedgeCards(new Vector3(), half, 50, [0.3, 0.4], createRandom(3));
    // Top (10 × 0.7) + two long sides (10 × 1) + two ends (0.7 × 1) = 28.4 m².
    expect(first).toHaveLength(Math.round(28.4 * 50));
    expect(second.map((card) => card.position.toArray())).toEqual(first.map((card) => card.position.toArray()));
    for (const card of first) {
      expect(card.normal.length()).toBeCloseTo(1);
      expect(card.position.y).toBeGreaterThan(-0.6);
    }
  });

  it("pack instance data with unit local normals and darker cards deeper in the crown", () => {
    const random = createRandom(9);
    const cards = ellipsoidCards(new Vector3(0, 4, 0), new Vector3(1.5, 1.2, 1.5), 20, [0.5, 0.8], random);
    const set = packCards(cards, random);
    expect(set.count).toBe(cards.length);
    expect(set.matrices).toHaveLength(cards.length * 16);
    for (let index = 0; index < set.count; index += 1) {
      const normal = new Vector3().fromArray(set.normals, index * 3);
      expect(normal.length()).toBeCloseTo(1);
    }
    const shade = (index: number) => set.colors[index * 3 + 1];
    const deep = cards.map((card, index) => ({ card, index })).filter(({ card }) => card.shell < 0.2);
    const outer = cards.map((card, index) => ({ card, index })).filter(({ card }) => card.shell > 0.9);
    const mean = (items: { index: number }[]) => items.reduce((sum, { index }) => sum + shade(index), 0) / items.length;
    expect(mean(deep)).toBeLessThan(mean(outer));
  });
});
