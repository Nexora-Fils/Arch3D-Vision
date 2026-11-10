import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../password";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).not.toContain("correct horse battery");
    expect(hash.startsWith("scrypt$32768$8$3$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("correct horse batterY", hash)).toBe(false);
  });

  it("salts every hash", async () => {
    const [first, second] = await Promise.all([hashPassword("même mot de passe"), hashPassword("même mot de passe")]);
    expect(first).not.toBe(second);
  });

  it("treats Unicode compositions of the same password alike", async () => {
    const hash = await hashPassword("café-maison");
    expect(await verifyPassword("café-maison", hash)).toBe(true);
  });

  it("rejects a malformed stored hash", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$10$abc")).toBe(false);
  });
});
