import { buildPlanFromSpec, type HouseTemplateSpec } from "./build";
import { CONTEMPORAINE } from "./contemporaine";
import { FAMILIALE } from "./familiale";
import { MINIMALISTE } from "./minimaliste";
import { PETITE } from "./petite";
import { TRADITIONNELLE } from "./traditionnelle";
import type { Plan } from "../schema";

export const HOUSE_TEMPLATES: HouseTemplateSpec[] = [CONTEMPORAINE, TRADITIONNELLE, MINIMALISTE, FAMILIALE, PETITE];

export type HouseTemplateKey = (typeof HOUSE_TEMPLATES)[number]["key"];

export const findTemplate = (key: string): HouseTemplateSpec | undefined => HOUSE_TEMPLATES.find((template) => template.key === key);

/** A complete, valid plan for the template (deterministic ids, ready to seed or clone). */
export const buildTemplatePlan = (key: string): Plan => {
  const template = findTemplate(key);
  if (!template) throw new Error(`Modèle inconnu : ${key}`);
  return buildPlanFromSpec(template);
};

export { buildPlanFromSpec, type HouseTemplateSpec } from "./build";
