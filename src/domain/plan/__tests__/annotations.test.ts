import { describe, expect, it } from "vitest";
import { clonePlan } from "../clone";
import { buildDemoPlan } from "../demo";
import { annotationSchema, floorSchema } from "../schema";

describe("annotations", () => {
  it("defaults to an empty list for floors saved before annotations existed", () => {
    const [floor] = buildDemoPlan().floors;
    const legacy: Partial<typeof floor> = { ...floor };
    delete legacy.annotations;
    expect(floorSchema.parse(legacy).annotations).toEqual([]);
  });

  it("validates kinds and caps the text length", () => {
    const base = { id: "a", start: { x: 0, y: 0 }, end: { x: 4, y: 0 }, text: "" };
    expect(annotationSchema.safeParse({ ...base, kind: "dimension" }).success).toBe(true);
    expect(annotationSchema.safeParse({ ...base, kind: "arrow" }).success).toBe(false);
    expect(annotationSchema.safeParse({ ...base, kind: "text", text: "x".repeat(81) }).success).toBe(false);
  });

  it("gets fresh ids when a plan is cloned", () => {
    const plan = buildDemoPlan();
    plan.floors[0].annotations = [{ id: "note-1", kind: "text", start: { x: 1, y: 1 }, end: { x: 1, y: 1 }, text: "Jardin" }];
    const copy = clonePlan(plan, { name: "Copie" });
    expect(copy.floors[0].annotations).toHaveLength(1);
    expect(copy.floors[0].annotations[0].id).not.toBe("note-1");
    expect(copy.floors[0].annotations[0].text).toBe("Jardin");
  });
});
