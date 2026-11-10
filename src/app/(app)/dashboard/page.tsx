import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, LayoutTemplate, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { HOUSE_TEMPLATES } from "@/domain/plan/templates";
import { ProjectGrid, ProjectGridSkeleton } from "@/features/dashboard/project-grid";
import { TEMPLATE_IMAGES } from "@/features/templates/template-images";
import { requireUser } from "@/lib/auth/session";
import { createFromTemplateAction } from "@/lib/projects/actions";

export const metadata: Metadata = { title: "Accueil" };

const Greeting = async () => {
  const { name } = await requireUser("/dashboard");
  const firstName = name.split(/\s+/)[0];
  return <h1 className="text-2xl font-semibold tracking-tight text-midnight">{firstName ? `Bonjour, ${firstName} !` : "Bonjour !"}</h1>;
};

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Suspense fallback={<Skeleton className="h-8 w-48" />}>
            <Greeting />
          </Suspense>
          <p className="text-sm text-muted-foreground">Voici un aperçu de vos projets récents.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button asChild>
            <Link href="/projects/new">
              Nouveau projet
              <Plus data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/templates">
              <LayoutTemplate data-icon="inline-start" />
              Utiliser un modèle
            </Link>
          </Button>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-midnight">Projets récents</h2>
        <Suspense fallback={<ProjectGridSkeleton />}>
          <ProjectGrid limit={3} />
        </Suspense>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-midnight">Modèles disponibles</h2>
          <Link href="/templates" className="flex items-center gap-1 text-sm font-medium text-electric hover:underline">
            Voir tous les modèles
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {HOUSE_TEMPLATES.map((template) => (
            <form key={template.key} action={createFromTemplateAction.bind(null, template.key)}>
              <button type="submit" title={`Créer un projet à partir du modèle « ${template.shortName} »`} className="group block w-full overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-shadow hover:shadow-md">
                <span className="relative block aspect-[4/3] overflow-hidden bg-muted">
                  <Image src={TEMPLATE_IMAGES[template.key]} alt={`Rendu 3D : ${template.name}`} fill sizes="(min-width: 1024px) 20vw, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                </span>
                <span className="block px-3 py-2 text-sm font-medium">{template.shortName}</span>
              </button>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
