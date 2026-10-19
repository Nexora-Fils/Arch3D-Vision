"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, Trash } from "lucide-react";
import { toast } from "sonner";
import { NumberField } from "@/components/number-field";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatArea } from "@/domain/plan/geometry";
import { MaterialsEditor } from "@/features/materials/materials-editor";
import { RoofFields } from "@/features/settings/roof-fields";
import { deleteProjectAction } from "@/lib/projects/actions";
import { usePlanStore } from "@/store/plan-store";

export const ProjectSettings = () => {
  const plan = usePlanStore((state) => state.plan);
  const { updateProject, updateSettings, updateFloor, addFloor, removeFloor, commit } = usePlanStore.getState();
  if (!plan) return null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto grid max-w-5xl gap-6 p-4 md:grid-cols-2 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Projet</CardTitle>
            <CardDescription>Nom et description affichés sur le tableau de bord.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="project-name">Nom</Label>
              <Input id="project-name" value={plan.name} maxLength={120} onChange={(event) => updateProject({ name: event.target.value }, { transient: true })} onBlur={commit} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-description">Description</Label>
              <Textarea id="project-description" rows={4} value={plan.description ?? ""} maxLength={2000} onChange={(event) => updateProject({ description: event.target.value || null }, { transient: true })} onBlur={commit} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Terrain et construction</CardTitle>
            <CardDescription>Surface du terrain : {formatArea(plan.lot.width * plan.lot.depth)}.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Largeur du terrain" unit="m" min={1} max={500} step={0.5} value={plan.lot.width} onChange={(width) => updateProject({ lot: { width } })} />
            <NumberField label="Profondeur du terrain" unit="m" min={1} max={500} step={0.5} value={plan.lot.depth} onChange={(depth) => updateProject({ lot: { depth } })} />
            <NumberField label="Hauteur des nouveaux murs" unit="m" min={2} max={6} step={0.05} value={plan.settings.defaultWallHeight} onChange={(defaultWallHeight) => updateSettings({ defaultWallHeight })} />
            <NumberField label="Épaisseur des nouveaux murs" unit="m" min={0.05} max={1} step={0.01} value={plan.settings.defaultWallThickness} onChange={(defaultWallThickness) => updateSettings({ defaultWallThickness })} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Toiture et façade</CardTitle>
            <CardDescription>Visible dans la vue 3D, modifiable en direct.</CardDescription>
          </CardHeader>
          <CardContent>
            <RoofFields />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Étages</CardTitle>
            <CardDescription>Chaque étage possède ses pièces, murs et meubles.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {plan.floors.map((floor) => (
              <div key={floor.id} className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground">Nom (niveau {floor.level})</Label>
                  <Input value={floor.name} onChange={(event) => updateFloor(floor.id, { name: event.target.value }, { transient: true })} onBlur={commit} />
                </div>
                <NumberField label="Hauteur" unit="m" min={2} max={6} step={0.05} value={floor.height} onChange={(height) => updateFloor(floor.id, { height })} className="w-28" />
                <Button variant="ghost" size="icon" disabled={plan.floors.length <= 1} onClick={() => removeFloor(floor.id)} aria-label={`Supprimer ${floor.name}`}>
                  <Trash />
                </Button>
              </div>
            ))}
            <Button variant="outline" className="w-fit" onClick={() => addFloor()}>
              <Plus data-icon="inline-start" />
              Ajouter un étage
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Bibliothèque de matériaux</CardTitle>
            <CardDescription>Couleurs et rugosité utilisées par les murs, sols, façade et toiture.</CardDescription>
          </CardHeader>
          <CardContent>
            <MaterialsEditor />
          </CardContent>
        </Card>

        <DangerZone projectId={plan.id} projectName={plan.name} />
      </div>
    </div>
  );
};

const DangerZone = ({ projectId, projectName }: { projectId: string; projectName: string }) => {
  const router = useRouter();
  const [isOpen, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () =>
    startTransition(async () => {
      const result = await deleteProjectAction(projectId);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const { plan } = usePlanStore.getState();
      if (plan) usePlanStore.getState().markSaved(plan, new Date());
      toast.success("Projet supprimé");
      router.push("/dashboard");
    });

  return (
    <Card className="border-destructive/30 md:col-span-2">
      <CardHeader>
        <CardTitle>Zone dangereuse</CardTitle>
        <CardDescription>La suppression efface définitivement le projet de PostgreSQL.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash data-icon="inline-start" />
          Supprimer le projet
        </Button>
        <AlertDialog open={isOpen} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer « {projectName} » ?</AlertDialogTitle>
              <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isPending}>
                {isPending ? "Suppression…" : "Supprimer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
