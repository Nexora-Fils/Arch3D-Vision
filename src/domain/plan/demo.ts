import type { Plan } from "./schema";
import { buildTemplatePlan } from "./templates";

export const DEMO_PROJECT_SLUG = "maison-familiale-moderne";
export const DEMO_PROJECT_NAME = "Maison familiale moderne";

/** The demo project is the « contemporaine » template, seeded with a stable slug. */
export const buildDemoPlan = (): Plan => buildTemplatePlan("contemporaine");
