import { Prisma } from "@/generated/prisma/client";
import { EmailTakenError } from "@/lib/auth/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import type { Account, LoginInput, SignupInput } from "@/lib/auth/schema";
import type { CurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const PUBLIC_FIELDS = { id: true, name: true, email: true } as const;

const isEmailTaken = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

export const createAccount = async ({ name, email, password }: SignupInput): Promise<CurrentUser> => {
  try {
    return await prisma.user.create({ data: { name, email, passwordHash: await hashPassword(password) }, select: PUBLIC_FIELDS });
  } catch (error) {
    if (isEmailTaken(error)) throw new EmailTakenError();
    throw error;
  }
};

/** Returns null for an unknown e-mail or a wrong password alike. */
export const authenticate = async ({ email, password }: LoginInput): Promise<CurrentUser | null> => {
  const user = await prisma.user.findUnique({ where: { email }, select: { ...PUBLIC_FIELDS, passwordHash: true } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return { id: user.id, name: user.name, email: user.email };
};

export const updateAccount = async (userId: string, account: Account): Promise<void> => {
  try {
    await prisma.user.update({ where: { id: userId }, data: account });
  } catch (error) {
    if (isEmailTaken(error)) throw new EmailTakenError();
    throw error;
  }
};
