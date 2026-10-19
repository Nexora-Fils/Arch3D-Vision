"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Box, EllipsisVertical, Footprints, PencilRuler, Settings, Trash } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteProjectAction } from "@/lib/projects/actions";

interface ProjectCardMenuProps {
  projectId: string;
  projectName: string;
}

export const ProjectCardMenu = ({ projectId, projectName }: ProjectCardMenuProps) => {
  const router = useRouter();
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteProjectAction(projectId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`« ${projectName} » supprimé`);
      setConfirmOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Actions du projet">
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => router.push(`/projects/${projectId}/editor`)}>
            <PencilRuler />
            Éditer le plan
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/projects/${projectId}/view`)}>
            <Box />
            Vue 3D
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/projects/${projectId}/walk`)}>
            <Footprints />
            Visiter l&apos;intérieur
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.push(`/projects/${projectId}/settings`)}>
            <Settings />
            Paramètres
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {projectName} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le projet, ses étages, pièces, murs, ouvertures et meubles seront définitivement supprimés de la base de données.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
