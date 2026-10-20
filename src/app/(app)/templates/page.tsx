import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { HOUSE_TEMPLATES } from "@/domain/plan/templates";
import { DETAILED_HOUSES } from "@/features/detailed-houses/catalog";
import { DetailedHouseCard } from "@/features/detailed-houses/detailed-house-card";
import { TemplateCard } from "@/features/templates/template-card";

export const metadata: Metadata = { title: "Modèles" };

export default function TemplatesPage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-midnight">Modèles de maisons</h1>
          <p className="text-sm text-muted-foreground">
            Plans modifiables : la maison 3D est générée à partir du plan 2D. Chaque modèle crée un projet indépendant que vous pouvez adapter pièce par pièce, puis visiter.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {HOUSE_TEMPLATES.map((template) => (
            <TemplateCard key={template.key} template={template} />
          ))}
          <Card className="flex flex-col items-center justify-center border-dashed p-8 text-center">
            <CardTitle>Page blanche</CardTitle>
            <CardDescription className="mt-2 max-w-xs">Définissez votre terrain et dessinez chaque pièce dans l&apos;éditeur 2D.</CardDescription>
            <Button asChild className="mt-6" variant="outline">
              <Link href="/projects/new">
                <Plus data-icon="inline-start" />
                Partir de zéro
              </Link>
            </Button>
          </Card>
        </div>
      </section>
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-midnight">Modèles détaillés</h2>
          <p className="text-sm text-muted-foreground">
            Maquettes 3D publiées par des artistes sur Sketchfab sous licence CC BY 4.0, à explorer en 3D. Ce sont des scènes figées : elles ne sont pas générées par l&apos;éditeur et ne se modifient pas.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {DETAILED_HOUSES.map((house) => (
            <DetailedHouseCard key={house.key} house={house} />
          ))}
        </div>
      </section>
    </div>
  );
}
