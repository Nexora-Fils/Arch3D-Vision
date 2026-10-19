import { describe, expect, it } from "vitest";
import { createEmptyPlan } from "../factory";
import { createProjectInputSchema, materialSchema, planSchema } from "../schema";

describe("schemas", () => {
  it("rejects a malformed color", () => {
    const result = materialSchema.safeParse({ id: "m", name: "x", kind: "wall", color: "red", roughness: 0.5 });
    expect(result.success).toBe(false);
  });

  it("coerces form values when creating a project", () => {
    const parsed = createProjectInputSchema.parse({ name: " Ma maison ", lotWidth: "20", lotDepth: "15", wallHeight: "2.7" });
    expect(parsed).toEqual({ name: "Ma maison", lotWidth: 20, lotDepth: 15, wallHeight: 2.7 });
    expect(createProjectInputSchema.safeParse({ name: "", lotWidth: 20, lotDepth: 15, wallHeight: 2.7 }).success).toBe(false);
  });

  it("builds an empty plan that satisfies the plan schema", () => {
    const plan = createEmptyPlan({ name: "Test", lotWidth: 20, lotDepth: 15, wallHeight: 2.7 });
    expect(planSchema.safeParse(plan).success).toBe(true);
    expect(plan.floors).toHaveLength(1);
    expect(plan.settings.roofMaterialId).not.toBeNull();
  });
});
