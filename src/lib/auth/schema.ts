import { z } from "zod";

const email = z.string().trim().toLowerCase().email("Adresse e-mail invalide").max(120, "120 caractères maximum");

export const accountSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis").max(60, "60 caractères maximum"),
  email,
});
export type Account = z.infer<typeof accountSchema>;

export const signupSchema = accountSchema.extend({
  password: z.string().min(8, "8 caractères minimum").max(128, "128 caractères maximum"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Le mot de passe est requis").max(128, "128 caractères maximum"),
});
export type LoginInput = z.infer<typeof loginSchema>;
