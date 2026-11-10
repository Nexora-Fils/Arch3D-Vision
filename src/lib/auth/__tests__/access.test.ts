import { describe, expect, it } from "vitest";
import { projectAccessVerdict } from "../access";

const OWNER = "user-owner";
const OTHER = "user-other";
const owned = { ownerId: OWNER };
const showcase = { ownerId: null };

describe("projectAccessVerdict", () => {
  it.each([
    ["owner reads", owned, OWNER, "read", "allowed"],
    ["owner writes", owned, OWNER, "write", "allowed"],
    ["another account reads", owned, OTHER, "read", "forbidden"],
    ["another account writes", owned, OTHER, "write", "forbidden"],
    ["a visitor reads", owned, null, "read", "unauthenticated"],
    ["a visitor writes", owned, null, "write", "unauthenticated"],
    ["a visitor reads the showcase", showcase, null, "read", "allowed"],
    ["an account reads the showcase", showcase, OTHER, "read", "allowed"],
    ["an account writes the showcase", showcase, OTHER, "write", "forbidden"],
    ["a visitor writes the showcase", showcase, null, "write", "unauthenticated"],
    ["an account reads an unknown project", null, OTHER, "read", "not-found"],
    ["a visitor reads an unknown project", null, null, "read", "not-found"],
    ["an account writes an unknown project", null, OTHER, "write", "not-found"],
    // Refused before revealing whether the project exists.
    ["a visitor writes an unknown project", null, null, "write", "unauthenticated"],
  ] as const)("%s", (_label, project, userId, access, expected) => {
    expect(projectAccessVerdict(project, userId, access)).toBe(expected);
  });
});
