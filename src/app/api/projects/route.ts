import { NextResponse } from "next/server";
import { createEmptyPlan } from "@/domain/plan/factory";
import { createProjectInputSchema } from "@/domain/plan/schema";
import { handleRouteError, readJsonBody } from "@/lib/api/respond";
import { createProject, listProjects } from "@/lib/projects/repository";

export async function GET() {
  try {
    return NextResponse.json(await listProjects());
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = createProjectInputSchema.parse(await readJsonBody(request));
    const plan = await createProject(createEmptyPlan(input));
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
