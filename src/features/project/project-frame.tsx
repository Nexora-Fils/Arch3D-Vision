"use client";

import { usePathname } from "next/navigation";
import { ProjectTopBar } from "@/features/project/project-top-bar";

/**
 * The 3D view and the walkthrough are full-bleed (their controls float over
 * the scene, as in the mockup); the editor and settings keep the app bar.
 */
export const ProjectFrame = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isImmersive = pathname.endsWith("/view") || pathname.endsWith("/walk");
  if (isImmersive) return <main className="h-dvh overflow-hidden">{children}</main>;
  return (
    <>
      <ProjectTopBar />
      <main className="workspace-height overflow-hidden">{children}</main>
    </>
  );
};
