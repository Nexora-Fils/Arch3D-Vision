import Image from "next/image";
import { Copy, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArea } from "@/domain/plan/geometry";
import { planStats } from "@/domain/plan/preview";
import { buildTemplatePlan, type HouseTemplateSpec } from "@/domain/plan/templates";
import { TemplateFacts } from "@/features/templates/template-facts";
import { TEMPLATE_IMAGES } from "@/features/templates/template-images";
import { createFromTemplateAction, openDemoProjectAction } from "@/lib/projects/actions";

interface TemplateCardProps {
  template: HouseTemplateSpec;
  compact?: boolean;
}

/** An editable house template: real render of its generated 3D, key figures computed from its plan, and the action that clones it into a new project. */
export const TemplateCard = ({ template, compact = false }: TemplateCardProps) => {
  const plan = buildTemplatePlan(template.key);
  const stats = planStats(plan);
  const image = TEMPLATE_IMAGES[template.key];
  const levels = plan.floors.length;
  return (
    <Card className="group flex flex-col overflow-hidden pt-0 transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {image ? <Image src={image} alt={`Rendu 3D généré à partir du plan : ${template.name}`} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : null}
        <Badge className="absolute top-3 left-3 bg-midnight/80 text-white backdrop-blur">Plan modifiable</Badge>
      </div>
      <CardHeader>
        <p className="text-xs font-medium uppercase tracking-wide text-electric">{template.style}</p>
        <CardTitle>{template.name}</CardTitle>
        {!compact ? <CardDescription>{template.description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <TemplateFacts
          facts={[
            { label: "Surface habitable", value: formatArea(Math.round(stats.habitableArea * 10) / 10) },
            { label: "Chambres", value: String(stats.bedrooms) },
            { label: "Salles de bain", value: String(stats.bathrooms) },
            { label: "Niveaux", value: levels > 1 ? String(levels) : "Plain-pied" },
            { label: "Terrain", value: formatArea(stats.lotArea) },
            { label: "Garage", value: stats.garages > 0 ? "Oui" : "Non" },
          ]}
        />
      </CardContent>
      <CardFooter className="mt-auto gap-2">
        <form action={createFromTemplateAction.bind(null, template.key)} className="flex-1">
          <Button type="submit" className="w-full" size="sm">
            <Copy data-icon="inline-start" />
            Utiliser ce modèle
          </Button>
        </form>
        {template.slug ? (
          <form action={openDemoProjectAction.bind(null, "view")}>
            <Button type="submit" variant="outline" size="sm" aria-label="Voir la démonstration en 3D">
              <Eye data-icon="inline-start" />
              Démo
            </Button>
          </form>
        ) : null}
      </CardFooter>
    </Card>
  );
};
