import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ProjectNotFoundError } from "@/lib/projects/repository";

export interface ApiError {
  error: string;
  issues?: { path: string; message: string }[];
}

export const jsonError = (status: number, error: string, issues?: ApiError["issues"]) =>
  NextResponse.json<ApiError>({ error, ...(issues ? { issues } : {}) }, { status });

export const formatZodIssues = (error: ZodError): ApiError["issues"] =>
  error.issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));

/** Maps domain, validation and database failures to HTTP responses. */
export const handleRouteError = (error: unknown) => {
  if (error instanceof ZodError) {
    return jsonError(400, "Données invalides", formatZodIssues(error));
  }
  if (error instanceof ProjectNotFoundError) {
    return jsonError(404, error.message);
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return jsonError(503, "Base de données inaccessible. Vérifiez que PostgreSQL est démarré (pnpm db:up).");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return jsonError(409, `Erreur base de données (${error.code})`);
  }
  console.error(error);
  return jsonError(500, "Erreur interne du serveur");
};

export const readJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};
