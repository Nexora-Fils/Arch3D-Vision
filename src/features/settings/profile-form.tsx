"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Account } from "@/lib/auth/schema";
import { saveProfileAction, type ProfileFormState } from "@/lib/profile/actions";

export const ProfileForm = ({ profile }: { profile: Account }) => {
  const [state, formAction, isPending] = useActionState<ProfileFormState, FormData>(saveProfileAction, {});
  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="profile-name">Prénom et nom</Label>
        <Input id="profile-name" name="name" defaultValue={profile.name} required maxLength={60} placeholder="Dieudonné Martin" aria-invalid={Boolean(state.errors?.name)} />
        <FieldError message={state.errors?.name} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="profile-email">E-mail</Label>
        <Input id="profile-email" name="email" type="email" defaultValue={profile.email} required maxLength={120} placeholder="vous@exemple.fr" aria-invalid={Boolean(state.errors?.email)} />
        <FieldError message={state.errors?.email} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          Enregistrer mon profil
        </Button>
        {state.saved ? <span className="text-sm text-emerald-600">Profil enregistré</span> : null}
      </div>
    </form>
  );
};
