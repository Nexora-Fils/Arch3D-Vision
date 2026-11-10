"use server";

import { redirect } from "next/navigation";
import { endSession } from "@/lib/auth/session";

export const signOutAction = async (): Promise<void> => {
  await endSession();
  redirect("/connexion");
};
