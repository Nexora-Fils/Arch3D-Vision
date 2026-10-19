import { Skeleton } from "@/components/ui/skeleton";
import { ProjectCard } from "@/features/dashboard/project-card";
import { listProjects } from "@/lib/projects/repository";

interface ProjectGridProps {
  limit?: number;
}

/** Server component: reads PostgreSQL and renders project cards. */
export const ProjectGrid = async ({ limit }: ProjectGridProps) => {
  const projects = await listProjects({ limit });
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-background p-12 text-center">
        <h2 className="text-lg font-medium">Aucun projet pour le moment</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Créez votre première maison, partez d&apos;un modèle ou chargez la « Maison familiale moderne ».
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
};

export const ProjectGridSkeleton = () => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 3 }, (_, index) => (
      <Skeleton key={index} className="h-56 rounded-xl" />
    ))}
  </div>
);
