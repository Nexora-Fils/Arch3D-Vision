import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "À propos" };

export default function AboutPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight text-midnight">À propos d&apos;Arch3D Vision</h1>
      <p className="text-muted-foreground">
        Arch3D Vision permet à chacun de dessiner le plan de sa maison, de la voir immédiatement en 3D et de la visiter pièce par pièce avant le début des travaux.
      </p>
      <p className="text-muted-foreground">
        Le plan, la maquette 3D et la visite partagent un seul modèle en mètres : chaque mur, ouverture, matériau et meuble modifié dans l&apos;éditeur se retrouve à l&apos;identique dans la maison 3D. Vos projets sont enregistrés dans votre base de données PostgreSQL.
      </p>
      <p className="text-muted-foreground">
        Le rendu 3D est calculé en temps réel dans le navigateur à partir de textures photographiques et de modèles scannés en licence libre (Poly Haven, CC0).
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/projects/new">Créer ma maison</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/templates">Voir les modèles</Link>
        </Button>
      </div>
    </div>
  );
}
