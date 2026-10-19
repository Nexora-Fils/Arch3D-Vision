import type { Metadata } from "next";
import { NewProjectForm } from "@/features/dashboard/new-project-form";

export const metadata: Metadata = { title: "Nouveau projet" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-midnight">Nouveau projet</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Définissez le terrain et la hauteur sous plafond. Vous dessinerez les pièces dans l&apos;éditeur 2D.
      </p>
      <div className="mt-6">
        <NewProjectForm />
      </div>
    </div>
  );
}
