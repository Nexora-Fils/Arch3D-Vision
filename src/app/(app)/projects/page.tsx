import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectGrid, ProjectGridSkeleton } from "@/features/dashboard/project-grid";

export const metadata: Metadata = { title: "Mes projets" };

export default function ProjectsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-midnight">Mes projets</h1>
          <p className="text-sm text-muted-foreground">Toutes vos maisons, du plus récent au plus ancien.</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus data-icon="inline-start" />
            Nouveau projet
          </Link>
        </Button>
      </div>
      <Suspense fallback={<ProjectGridSkeleton />}>
        <ProjectGrid />
      </Suspense>
    </div>
  );
}
