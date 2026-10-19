"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clonePlan } from "@/domain/plan/clone";
import { buildDemoPlan } from "@/domain/plan/demo";
import { createEmptyPlan } from "@/domain/plan/factory";
import { buildTemplatePlan, findTemplate } from "@/domain/plan/templates";
import { createProjectInputSchema } from "@/domain/plan/schema";
import { createProject, deleteProject, ensureProjectBySlug, listProjects } from "@/lib/projects/repository";

export interface CreateProjectFormState {
  errors?: Partial<Record<"name" | "description" | "lotWidth" | "lotDepth" | "wallHeight" | "form", string>>;
  values?: Record<string, string>;
}

const formValues = (formData: FormData): Record<string, string> =>
  Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)]));

export const createProjectAction = async (
  _previous: CreateProjectFormState,
  formData: FormData,
): Promise<CreateProjectFormState> => {
  const values = formValues(formData);
  const parsed = createProjectInputSchema.safeParse(values);
  if (!parsed.success) {
    const errors: CreateProjectFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && key in values && !(key in errors)) {
        errors[key as keyof NonNullable<CreateProjectFormState["errors"]>] = issue.message;
      }
    }
    return { errors, values };
  }

  let projectId: string;
  try {
    const plan = await createProject(createEmptyPlan(parsed.data));
    projectId = plan.id;
  } catch (error) {
    console.error(error);
    return { errors: { form: "Impossible d'enregistrer le projet. La base de données est-elle démarrée ?" }, values };
  }
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirect(`/projects/${projectId}/editor`);
};

export const deleteProjectAction = async (projectId: string): Promise<{ error?: string }> => {
  try {
    await deleteProject(projectId);
  } catch (error) {
    console.error(error);
    return { error: "Suppression impossible." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  return {};
};

export type ProjectScreen = "editor" | "view" | "walk" | "settings";

/** Creates the demo project if needed, then opens it. Never duplicates it. */
export const openDemoProjectAction = async (target: ProjectScreen = "editor"): Promise<void> => {
  const { plan } = await ensureProjectBySlug(buildDemoPlan());
  revalidatePath("/dashboard");
  redirect(`/projects/${plan.id}/${target}`);
};

/** Starts a new project from a house template: same plan, fresh ids, editable independently. */
export const createFromTemplateAction = async (templateKey: string): Promise<void> => {
  const template = findTemplate(templateKey);
  if (!template) throw new Error("Modèle inconnu");
  const source = buildTemplatePlan(template.key);
  const existing = await listProjects();
  const siblings = existing.filter((project) => project.name === template.name || project.name.startsWith(`${template.name} (`)).length;
  const name = siblings === 0 ? template.name : `${template.name} (${siblings + 1})`;
  const plan = await createProject(clonePlan(source, { name }));
  revalidatePath("/dashboard");
  revalidatePath("/projects");
  redirect(`/projects/${plan.id}/editor`);
};
