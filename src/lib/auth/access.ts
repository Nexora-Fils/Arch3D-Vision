export type ProjectAccess = "read" | "write";
export type ProjectAccessVerdict = "allowed" | "unauthenticated" | "forbidden" | "not-found";

/**
 * A project without owner is a public showcase (the seeded demo): everyone may
 * read it, nobody may change it. Any other project is reserved to its owner.
 * Anonymous writes are refused before revealing whether the project exists.
 */
export const projectAccessVerdict = (project: { ownerId: string | null } | null, userId: string | null, access: ProjectAccess): ProjectAccessVerdict => {
  if (access === "write" && !userId) return "unauthenticated";
  if (!project) return "not-found";
  if (project.ownerId === null) return access === "read" ? "allowed" : "forbidden";
  if (!userId) return "unauthenticated";
  return project.ownerId === userId ? "allowed" : "forbidden";
};
