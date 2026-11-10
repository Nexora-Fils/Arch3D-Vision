import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { loginPath } from "@/lib/auth/next-path";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie";
import { prisma } from "@/lib/prisma";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

/** The cookie holds a random token; the database only stores its SHA-256. */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Route Handlers and Server Actions only: Server Components cannot set cookies. */
export const startSession = async (userId: string): Promise<void> => {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await Promise.all([
    prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } }),
    prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } }),
  ]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
};

export const endSession = async (): Promise<void> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  store.delete(SESSION_COOKIE);
};

/** Verified against the database once per request (React cache). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    select: { expiresAt: true, user: { select: { id: true, name: true, email: true } } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
});

/** Pages and Server Actions: sends a visitor without a valid session to the login page. */
export const requireUser = async (next?: string): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(next));
  return user;
};
