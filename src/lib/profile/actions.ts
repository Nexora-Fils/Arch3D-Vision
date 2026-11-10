"use server";

import { revalidatePath } from "next/cache";
import { updateAccount } from "@/lib/auth/accounts";
import { EmailTakenError } from "@/lib/auth/errors";
import { accountSchema } from "@/lib/auth/schema";
import { requireUser } from "@/lib/auth/session";

export interface ProfileFormState {
  errors?: Partial<Record<"name" | "email", string>>;
  saved?: boolean;
}

export const saveProfileAction = async (_previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> => {
  const user = await requireUser("/settings");
  const parsed = accountSchema.safeParse({ name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") });
  if (!parsed.success) {
    const errors: ProfileFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "name" || key === "email") && !errors[key]) errors[key] = issue.message;
    }
    return { errors };
  }
  try {
    await updateAccount(user.id, parsed.data);
  } catch (error) {
    if (error instanceof EmailTakenError) return { errors: { email: error.message } };
    throw error;
  }
  revalidatePath("/", "layout");
  return { saved: true };
};
