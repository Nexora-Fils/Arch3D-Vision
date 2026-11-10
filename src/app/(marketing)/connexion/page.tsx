import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCard } from "@/features/auth/auth-card";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <AuthCard title="Se connecter" description="Retrouvez vos maisons depuis n'importe quel appareil.">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <AuthForm mode="login" />
      </Suspense>
    </AuthCard>
  );
}
