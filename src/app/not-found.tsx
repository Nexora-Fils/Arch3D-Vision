import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-sm font-medium text-electric">Erreur 404</p>
      <h1 className="text-xl font-semibold">Page ou projet introuvable</h1>
      <p className="max-w-md text-sm text-muted-foreground">Cette page n&apos;existe pas, ou le projet a été supprimé de la base de données.</p>
      <Button asChild>
        <Link href="/dashboard">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}
