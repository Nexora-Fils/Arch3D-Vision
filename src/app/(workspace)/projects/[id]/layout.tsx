import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectProvider } from "@/features/project/project-provider";
import { ProjectFrame } from "@/features/project/project-frame";
import { getProjectWithMeta } from "@/lib/projects/repository";

interface ProjectLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default function ProjectLayout({ children, params }: ProjectLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <Suspense fallback={<WorkspaceSkeleton />}>
        <ProjectLoader params={params}>{children}</ProjectLoader>
      </Suspense>
    </div>
  );
}

const ProjectLoader = async ({ children, params }: ProjectLayoutProps) => {
  const { id } = await params;
  const record = await getProjectWithMeta(id);
  if (!record) notFound();
  return (
    <ProjectProvider plan={record.plan} updatedAt={record.updatedAt.toISOString()}>
      <ProjectFrame>{children}</ProjectFrame>
    </ProjectProvider>
  );
};

const WorkspaceSkeleton = () => (
  <div className="flex flex-1 flex-col">
    <div className="h-14 bg-midnight" />
    <div className="flex flex-1 gap-3 p-3">
      <Skeleton className="hidden w-14 md:block" />
      <Skeleton className="flex-1" />
      <Skeleton className="hidden w-80 lg:block" />
    </div>
  </div>
);
