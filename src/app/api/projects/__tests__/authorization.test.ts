import { beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPlan } from "@/domain/plan/factory";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { createProject, deleteProject, findProjectOwner, getProjectPlan, listProjects, replaceProjectPlan, setProjectThumbnail } from "@/lib/projects/repository";
import { GET as listRoute, POST as createRoute } from "../route";
import { DELETE as deleteRoute, GET as readRoute, PUT as saveRoute } from "../[id]/route";
import { PUT as thumbnailRoute } from "../[id]/thumbnail/route";

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/projects/repository", () => ({
  ProjectNotFoundError: class ProjectNotFoundError extends Error {},
  createProject: vi.fn(),
  deleteProject: vi.fn(),
  findProjectOwner: vi.fn(),
  getProjectPlan: vi.fn(),
  listProjects: vi.fn(),
  replaceProjectPlan: vi.fn(),
  setProjectThumbnail: vi.fn(),
}));

const OWNER: CurrentUser = { id: "user-owner", name: "Lucie Martin", email: "lucie@exemple.fr" };
const OTHER: CurrentUser = { id: "user-other", name: "Paul Durand", email: "paul@exemple.fr" };
const PROJECT_ID = "project-1";
const plan = { ...createEmptyPlan({ name: "Maison de Lucie", lotWidth: 20, lotDepth: 15, wallHeight: 2.7 }), id: PROJECT_ID };
const TINY_JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

const signIn = (user: CurrentUser | null) => vi.mocked(getCurrentUser).mockResolvedValue(user);
const storeProject = (owner: { ownerId: string | null } | null) => vi.mocked(findProjectOwner).mockResolvedValue(owner);

const jsonRequest = (method: string, body: unknown) =>
  new Request(`http://localhost/api/projects/${PROJECT_ID}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const context = { params: Promise.resolve({ id: PROJECT_ID }) };

const read = () => readRoute(new Request(`http://localhost/api/projects/${PROJECT_ID}`), context);
const save = () => saveRoute(jsonRequest("PUT", plan), context);
const remove = () => deleteRoute(new Request(`http://localhost/api/projects/${PROJECT_ID}`, { method: "DELETE" }), context);
const saveThumbnail = () => thumbnailRoute(jsonRequest("PUT", { dataUrl: TINY_JPEG }), context);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getProjectPlan).mockResolvedValue(plan);
  vi.mocked(replaceProjectPlan).mockResolvedValue({ updatedAt: new Date("2026-11-10T08:00:00Z") });
  vi.mocked(listProjects).mockResolvedValue([]);
  vi.mocked(createProject).mockImplementation(async (input) => input);
});

describe("/api/projects", () => {
  it("refuses a visitor: 401 on list and creation", async () => {
    signIn(null);
    expect((await listRoute()).status).toBe(401);
    expect((await createRoute(jsonRequest("POST", { name: "x", lotWidth: 10, lotDepth: 10, wallHeight: 2.5 }))).status).toBe(401);
    expect(listProjects).not.toHaveBeenCalled();
    expect(createProject).not.toHaveBeenCalled();
  });

  it("lists only the signed-in account's projects and owns the created one", async () => {
    signIn(OWNER);
    expect((await listRoute()).status).toBe(200);
    expect(listProjects).toHaveBeenCalledWith({ ownerId: OWNER.id });
    expect((await createRoute(jsonRequest("POST", { name: "Maison", lotWidth: 10, lotDepth: 10, wallHeight: 2.5 }))).status).toBe(201);
    expect(createProject).toHaveBeenCalledWith(expect.objectContaining({ name: "Maison" }), OWNER.id);
  });
});

describe("/api/projects/:id on a private project", () => {
  beforeEach(() => storeProject({ ownerId: OWNER.id }));

  it("answers 401 to a visitor and changes nothing", async () => {
    signIn(null);
    expect((await read()).status).toBe(401);
    expect((await save()).status).toBe(401);
    expect((await remove()).status).toBe(401);
    expect((await saveThumbnail()).status).toBe(401);
    expect(replaceProjectPlan).not.toHaveBeenCalled();
    expect(deleteProject).not.toHaveBeenCalled();
    expect(setProjectThumbnail).not.toHaveBeenCalled();
  });

  it("answers 403 to another account and changes nothing", async () => {
    signIn(OTHER);
    expect((await read()).status).toBe(403);
    expect((await save()).status).toBe(403);
    expect((await remove()).status).toBe(403);
    expect((await saveThumbnail()).status).toBe(403);
    expect(getProjectPlan).not.toHaveBeenCalled();
    expect(replaceProjectPlan).not.toHaveBeenCalled();
    expect(deleteProject).not.toHaveBeenCalled();
    expect(setProjectThumbnail).not.toHaveBeenCalled();
  });

  it("lets the owner read, save, capture and delete", async () => {
    signIn(OWNER);
    expect((await read()).status).toBe(200);
    expect((await save()).status).toBe(200);
    expect((await saveThumbnail()).status).toBe(200);
    expect((await remove()).status).toBe(204);
    expect(deleteProject).toHaveBeenCalledWith(PROJECT_ID);
  });
});

describe("/api/projects/:id on the public showcase (no owner)", () => {
  beforeEach(() => storeProject({ ownerId: null }));

  it("is readable without an account", async () => {
    signIn(null);
    expect((await read()).status).toBe(200);
  });

  it("is read-only for every account", async () => {
    signIn(OWNER);
    expect((await save()).status).toBe(403);
    expect((await remove()).status).toBe(403);
    expect((await saveThumbnail()).status).toBe(403);
    expect(replaceProjectPlan).not.toHaveBeenCalled();
    expect(deleteProject).not.toHaveBeenCalled();
  });
});

describe("/api/projects/:id on an unknown project", () => {
  beforeEach(() => storeProject(null));

  it("answers 404 to an account and 401 to an anonymous write", async () => {
    signIn(OWNER);
    expect((await read()).status).toBe(404);
    expect((await save()).status).toBe(404);
    signIn(null);
    expect((await remove()).status).toBe(401);
  });
});

it("rejects a body that is not sent as JSON, so a cross-site form cannot reach the API", async () => {
  signIn(OWNER);
  storeProject({ ownerId: OWNER.id });
  const formPost = new Request(`http://localhost/api/projects/${PROJECT_ID}`, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(plan) });
  expect((await saveRoute(formPost, context)).status).toBe(400);
  expect(replaceProjectPlan).not.toHaveBeenCalled();
});
