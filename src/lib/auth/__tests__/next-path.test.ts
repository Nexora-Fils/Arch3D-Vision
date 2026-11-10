import { describe, expect, it } from "vitest";
import { loginPath, safeNextPath } from "../next-path";

describe("safeNextPath", () => {
  it("keeps a same-site path with its query and hash", () => {
    expect(safeNextPath("/projects/new")).toBe("/projects/new");
    expect(safeNextPath("/settings?tab=1#mon-compte")).toBe("/settings?tab=1#mon-compte");
  });

  it.each([null, undefined, "", "dashboard", "https://evil.example/", "//evil.example", "/\\evil.example", "/\t/evil.example", "javascript:alert(1)"])(
    "falls back to the dashboard for %j",
    (value) => {
      expect(safeNextPath(value)).toBe("/dashboard");
    },
  );
});

describe("loginPath", () => {
  it("encodes the page to come back to", () => {
    expect(loginPath()).toBe("/connexion");
    expect(loginPath("/settings?tab=1")).toBe("/connexion?next=%2Fsettings%3Ftab%3D1");
  });
});
