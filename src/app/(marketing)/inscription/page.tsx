import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCard } from "@/features/auth/auth-card";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = { title: "Inscription" };

export default function SignupPage() {
  return (
    <AuthCard title="Créer un compte" description="Vos projets sont enregistrés sur votre compte et visibles par vous seul.">
      <Suspense fallback={<Skeleton className="h-80" />}>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthCard>
  );
}
