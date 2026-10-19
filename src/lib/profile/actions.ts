"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { PROFILE_COOKIES, profileSchema } from "@/lib/profile/profile";

export interface ProfileFormState {
  errors?: Partial<Record<"name" | "email", string>>;
  saved?: boolean;
}

const ONE_YEAR = 60 * 60 * 24 * 365;

export const saveProfileAction = async (_previous: ProfileFormState, formData: FormData): Promise<ProfileFormState> => {
  const parsed = profileSchema.safeParse({ name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") });
  if (!parsed.success) {
    const errors: ProfileFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "name" || key === "email") && !errors[key]) errors[key] = issue.message;
    }
    return { errors };
  }
  const store = await cookies();
  const options = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: ONE_YEAR };
  store.set(PROFILE_COOKIES.name, parsed.data.name, options);
  store.set(PROFILE_COOKIES.email, parsed.data.email, options);
  revalidatePath("/", "layout");
  return { saved: true };
};
