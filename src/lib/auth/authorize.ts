import { projectAccessVerdict, type ProjectAccess } from "@/lib/auth/access";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/errors";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { findProjectOwner, ProjectNotFoundError } from "@/lib/projects/repository";

/** API routes: 401 without a valid session (see handleRouteError). */
export const requireApiUser = async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
};

/** Throws the error matching the verdict: 401, 403 or 404 once mapped by handleRouteError. */
export const authorizeProject = async (projectId: string, access: ProjectAccess): Promise<void> => {
  const [user, project] = await Promise.all([getCurrentUser(), findProjectOwner(projectId)]);
  const verdict = projectAccessVerdict(project, user?.id ?? null, access);
  if (verdict === "unauthenticated") throw new UnauthorizedError();
  if (verdict === "forbidden") throw new ForbiddenError();
  if (verdict === "not-found") throw new ProjectNotFoundError(projectId);
};
