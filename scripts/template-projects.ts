import "dotenv/config";
import { buildTemplatePlan, HOUSE_TEMPLATES } from "../src/domain/plan/templates";
import { prisma } from "../src/lib/prisma";
import { createProject, deleteProject } from "../src/lib/projects/repository";

/**
 * Dev utility: creates (or removes) one project per house template, with the
 * template's deterministic ids, to inspect every model in the real app.
 *   pnpm exec tsx scripts/template-projects.ts create
 *   pnpm exec tsx scripts/template-projects.ts delete
 */
const mode = process.argv[2] === "delete" ? "delete" : "create";

const run = async () => {
  for (const template of HOUSE_TEMPLATES) {
    if (template.key === "contemporaine") continue;
    const plan = buildTemplatePlan(template.key);
    const exists = await prisma.project.findUnique({ where: { id: plan.id }, select: { id: true } });
    if (exists) await deleteProject(plan.id);
    if (mode === "create") {
      const created = await createProject(plan, null);
      console.log(`créé      ${template.key.padEnd(14)} ${created.id}`);
    } else {
      console.log(`supprimé  ${template.key.padEnd(14)} ${plan.id}`);
    }
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
