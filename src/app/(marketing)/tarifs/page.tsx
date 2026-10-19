import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Tarifs" };

const INCLUDED = [
  "Projets illimités enregistrés dans votre base PostgreSQL",
  "Éditeur 2D : pièces, murs, portes, fenêtres, meubles",
  "Génération 3D et visite intérieure",
  "Matériaux, styles et toiture personnalisables",
];

export default function PricingPage() {
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-midnight">Tarifs</h1>
        <p className="mt-2 text-muted-foreground">HomePlan 3D est un prototype : toutes les fonctionnalités sont ouvertes, sans abonnement.</p>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Prototype</CardTitle>
          <CardDescription>Pour concevoir et visiter votre maison dès aujourd&apos;hui.</CardDescription>
          <p className="pt-2 text-4xl font-semibold text-midnight">
            0 € <span className="text-base font-normal text-muted-foreground">/ mois</span>
          </p>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2 text-sm">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-electric" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/projects/new">Commencer maintenant</Link>
          </Button>
        </CardFooter>
      </Card>
      <p className="max-w-md text-center text-xs text-muted-foreground">
        Des offres avec comptes, partage et hébergement des projets seront définies avec l&apos;arrivée de l&apos;authentification.
      </p>
    </div>
  );
}
