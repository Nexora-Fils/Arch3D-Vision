import { NextResponse } from "next/server";
import { planSchema } from "@/domain/plan/schema";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/api/respond";
import { authorizeProject } from "@/lib/auth/authorize";
import { deleteProject, getProjectPlan, replaceProjectPlan } from "@/lib/projects/repository";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    await authorizeProject(id, "read");
    const plan = await getProjectPlan(id);
    if (!plan) return jsonError(404, `Projet introuvable : ${id}`);
    return NextResponse.json(plan);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    await authorizeProject(id, "write");
    const plan = planSchema.parse(await readJsonBody(request));
    if (plan.id !== id) return jsonError(400, "L'identifiant du plan ne correspond pas à l'URL");
    const result = await replaceProjectPlan(plan);
    return NextResponse.json({ id, updatedAt: result.updatedAt.toISOString() });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    await authorizeProject(id, "write");
    await deleteProject(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
