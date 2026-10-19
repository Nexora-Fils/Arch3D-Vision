import Image from "next/image";
import { Copy, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { formatArea } from "@/domain/plan/geometry";
import { formatPlanStats, planStats } from "@/domain/plan/preview";
import { buildTemplatePlan, type HouseTemplateSpec } from "@/domain/plan/templates";
import { TEMPLATE_IMAGES } from "@/features/templates/template-images";
import { createFromTemplateAction, openDemoProjectAction } from "@/lib/projects/actions";

interface TemplateCardProps {
  template: HouseTemplateSpec;
  compact?: boolean;
}

/** A house template: real render, key figures, and the action that clones it into a new project. */
export const TemplateCard = ({ template, compact = false }: TemplateCardProps) => {
  const plan = buildTemplatePlan(template.key);
  const stats = planStats(plan);
  const image = TEMPLATE_IMAGES[template.key];
  return (
    <Card className="group flex flex-col overflow-hidden pt-0 transition-shadow hover:shadow-lg">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {image ? <Image src={image} alt={`Rendu 3D : ${template.name}`} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : null}
        <Badge className="absolute top-3 left-3 bg-midnight/80 text-white backdrop-blur">{plan.floors.length > 1 ? `${plan.floors.length} niveaux` : "Plain-pied"}</Badge>
      </div>
      <CardHeader>
        <CardTitle>{template.name}</CardTitle>
        {!compact ? <CardDescription>{template.description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        <Badge variant="secondary">{formatArea(stats.livingArea)}</Badge>
        <Badge variant="secondary">{formatPlanStats(stats)}</Badge>
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
