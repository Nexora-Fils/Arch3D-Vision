import Image from "next/image";
import Link from "next/link";
import { Rotate3d } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMeters } from "@/domain/plan/geometry";
import { interiorNote, type DetailedHouse } from "@/features/detailed-houses/catalog";
import { DETAILED_IMAGES } from "@/features/detailed-houses/detailed-images";
import { TemplateFacts } from "@/features/templates/template-facts";

/** A detailed third-party model: real render from the app, measured figures, attribution, and a link to its 3D view. */
export const DetailedHouseCard = ({ house }: { house: DetailedHouse }) => {
  const image = DETAILED_IMAGES[house.key];
  return (
    <Card className="group flex flex-col overflow-hidden pt-0 transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {image ? <Image src={image} alt={`Rendu 3D du modèle détaillé : ${house.name}`} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : null}
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge className="bg-midnight/80 text-white backdrop-blur">Modèle détaillé</Badge>
          <Badge className="bg-amber-500/90 text-white backdrop-blur">Vue 3D seule</Badge>
        </div>
      </div>
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-wide text-electric">{house.style}</p>
        <CardTitle>{house.name}</CardTitle>
        <CardDescription>{house.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <TemplateFacts
          facts={[
            { label: "Niveaux", value: String(house.levels) },
            { label: "Emprise", value: `${formatMeters(house.footprint.width)} × ${formatMeters(house.footprint.depth)}` },
            { label: "Hauteur", value: formatMeters(house.height) },
          ]}
        />
        <p className="text-xs text-muted-foreground">{interiorNote(house)} Non modifiable : maquette sans plan, donc sans surface habitable, chambres ni salles de bain renseignées.</p>
        <p className="text-xs text-muted-foreground">
          <a href={house.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            « {house.sourceTitle} » par {house.author}
          </a>{" "}
          · Sketchfab ·{" "}
          <a href={house.license.url} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
            {house.license.name}
          </a>
        </p>
      </CardContent>
      <CardFooter className="mt-auto">
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link href={`/templates/detailed/${house.key}`}>
            <Rotate3d data-icon="inline-start" />
            Explorer en 3D
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};
