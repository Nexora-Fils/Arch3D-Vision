import Image from "next/image";
import Link from "next/link";
import { PlanSvg } from "@/components/plan-svg";
import { ProjectCardMenu } from "@/features/dashboard/project-card-menu";
import type { ProjectSummary } from "@/lib/projects/repository";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** Mockup project card: real 3D render, name, last modification date and a discreet menu. */
export const ProjectCard = ({ project }: { project: ProjectSummary }) => (
  <article className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-lg">
    <Link href={`/projects/${project.id}/editor`} className="relative block aspect-[16/10] overflow-hidden bg-[#dde7d2]" aria-label={`Ouvrir ${project.name}`}>
      {project.thumbnail ? (
        <Image src={project.thumbnail} alt={`Rendu 3D de ${project.name}`} fill unoptimized sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      ) : (
        <div className="h-full w-full p-4">
          <PlanSvg preview={project.preview} />
        </div>
      )}
    </Link>
    <div className="flex items-start justify-between gap-2 p-3">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold">{project.name}</h3>
        <p className="text-xs text-muted-foreground">Modifié le {dateFormatter.format(project.updatedAt)}</p>
      </div>
      <ProjectCardMenu projectId={project.id} projectName={project.name} />
    </div>
  </article>
);
