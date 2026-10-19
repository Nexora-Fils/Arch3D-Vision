import { cookies } from "next/headers";
import { z } from "zod";

/** Until authentication exists, the display name and e-mail live in two cookies. */
export const PROFILE_COOKIES = { name: "hp_profile_name", email: "hp_profile_email" } as const;

export const profileSchema = z.object({
  name: z.string().trim().max(60, "60 caractères maximum"),
  email: z.union([z.literal(""), z.string().trim().email("Adresse e-mail invalide").max(120)]),
});
export type Profile = z.infer<typeof profileSchema>;

export const getProfile = async (): Promise<Profile> => {
  const store = await cookies();
  const parsed = profileSchema.safeParse({ name: store.get(PROFILE_COOKIES.name)?.value ?? "", email: store.get(PROFILE_COOKIES.email)?.value ?? "" });
  return parsed.success ? parsed.data : { name: "", email: "" };
};

export const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
