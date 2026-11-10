"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";

const SignOutButton = () => {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" disabled={pending} className="justify-self-start">
      {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <LogOut data-icon="inline-start" />}
      Se déconnecter
    </Button>
  );
};

export const SignOutForm = () => (
  <form action={signOutAction}>
    <SignOutButton />
  </form>
);
