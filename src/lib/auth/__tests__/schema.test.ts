import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "../schema";

describe("account schemas", () => {
  it("normalizes the e-mail so one address maps to one account", () => {
    const parsed = signupSchema.parse({ name: " Lucie Martin ", email: "  Lucie@Exemple.FR ", password: "12345678" });
    expect(parsed).toEqual({ name: "Lucie Martin", email: "lucie@exemple.fr", password: "12345678" });
    expect(loginSchema.parse({ email: "LUCIE@exemple.fr", password: "x" }).email).toBe("lucie@exemple.fr");
  });

  it("rejects a short password, a missing name and a malformed e-mail", () => {
    const result = signupSchema.safeParse({ name: " ", email: "lucie", password: "1234567" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0]).sort()).toEqual(["email", "name", "password"]);
  });
});
