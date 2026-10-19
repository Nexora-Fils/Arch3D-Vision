"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProfileAction, type ProfileFormState } from "@/lib/profile/actions";
import type { Profile } from "@/lib/profile/profile";

export const ProfileForm = ({ profile }: { profile: Profile }) => {
  const [state, formAction, isPending] = useActionState<ProfileFormState, FormData>(saveProfileAction, {});
  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="profile-name">Prénom et nom</Label>
        <Input id="profile-name" name="name" defaultValue={profile.name} maxLength={60} placeholder="Dieudonné Martin" aria-invalid={Boolean(state.errors?.name)} />
        {state.errors?.name ? <p className="text-xs text-destructive">{state.errors.name}</p> : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="profile-email">E-mail</Label>
        <Input id="profile-email" name="email" type="email" defaultValue={profile.email} maxLength={120} placeholder="vous@exemple.fr" aria-invalid={Boolean(state.errors?.email)} />
        {state.errors?.email ? <p className="text-xs text-destructive">{state.errors.email}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          Enregistrer mon profil
        </Button>
        {state.saved ? <span className="text-sm text-emerald-600">Profil enregistré</span> : null}
      </div>
      <p className="text-xs text-muted-foreground">Sans compte pour l&apos;instant : ces informations restent sur cet appareil (cookie) et servent à personnaliser l&apos;accueil.</p>
    </form>
  );
};
