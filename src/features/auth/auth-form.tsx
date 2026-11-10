"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiError } from "@/lib/api/respond";
import { safeNextPath } from "@/lib/auth/next-path";

type AuthMode = "login" | "signup";

const AUTH_FIELDS = ["name", "email", "password"] as const;
type AuthField = (typeof AUTH_FIELDS)[number];
type AuthErrors = Partial<Record<AuthField | "form", string>>;

const isAuthField = (path: string): path is AuthField => (AUTH_FIELDS as readonly string[]).includes(path);

const MODES = {
  login: { endpoint: "/api/auth/login", submitLabel: "Se connecter", switchPrompt: "Pas encore de compte ?", switchLabel: "Créer un compte", switchHref: "/inscription" },
  signup: { endpoint: "/api/auth/signup", submitLabel: "Créer mon compte", switchPrompt: "Déjà inscrit ?", switchLabel: "Se connecter", switchHref: "/connexion" },
} as const;

/** Field errors come from the Zod issues (400) or the e-mail conflict (409); anything else is a form error. */
const toAuthErrors = (body: ApiError | null): AuthErrors => {
  const errors: AuthErrors = {};
  for (const issue of body?.issues ?? []) {
    if (isAuthField(issue.path) && !errors[issue.path]) errors[issue.path] = issue.message;
  }
  if (Object.keys(errors).length === 0) errors.form = body?.error ?? "Le serveur ne répond pas. Réessayez dans un instant.";
  return errors;
};

export const AuthForm = ({ mode }: { mode: AuthMode }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errors, setErrors] = useState<AuthErrors>({});
  const [isPending, startTransition] = useTransition();
  const { endpoint, submitLabel, switchPrompt, switchLabel, switchHref } = MODES[mode];
  const query = searchParams.toString();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)));
    startTransition(async () => {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body }).catch(() => null);
      if (response?.ok) {
        router.replace(safeNextPath(searchParams.get("next")));
        router.refresh();
        return;
      }
      setErrors(toAuthErrors((await response?.json().catch(() => null)) as ApiError | null));
    });
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      {mode === "signup" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="auth-name">Prénom et nom</Label>
          <Input id="auth-name" name="name" autoComplete="name" required maxLength={60} aria-invalid={Boolean(errors.name)} aria-describedby="auth-name-error" />
          <FieldError id="auth-name-error" message={errors.name} />
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor="auth-email">E-mail</Label>
        <Input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={120} placeholder="vous@exemple.fr" aria-invalid={Boolean(errors.email)} aria-describedby="auth-email-error" />
        <FieldError id="auth-email-error" message={errors.email} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="auth-password">Mot de passe</Label>
        <Input
          id="auth-password"
          name="password"
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
          maxLength={128}
          aria-invalid={Boolean(errors.password)}
          aria-describedby="auth-password-error"
        />
        {mode === "signup" && !errors.password ? <p className="text-xs text-muted-foreground">8 caractères minimum.</p> : null}
        <FieldError id="auth-password-error" message={errors.password} />
      </div>
      {errors.form ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" disabled={isPending} className="mt-1">
        {isPending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
        {submitLabel}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {switchPrompt}{" "}
        <Link href={query ? `${switchHref}?${query}` : switchHref} className="font-medium text-electric hover:underline">
          {switchLabel}
        </Link>
      </p>
    </form>
  );
};
