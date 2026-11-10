import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { EmailTakenError, ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
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
  if (error instanceof UnauthorizedError) {
    return jsonError(401, error.message);
  }
  if (error instanceof ForbiddenError) {
    return jsonError(403, error.message);
  }
  if (error instanceof EmailTakenError) {
    return jsonError(409, error.message, [{ path: "email", message: error.message }]);
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

/** JSON only: a cross-site HTML form cannot send application/json, which keeps cookie-authenticated routes out of CSRF reach. */
export const readJsonBody = async (request: Request): Promise<unknown> => {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return null;
  try {
    return await request.json();
  } catch {
    return null;
  }
};
