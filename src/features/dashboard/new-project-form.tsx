"use client";

import { useActionState, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatArea } from "@/domain/plan/geometry";
import { createProjectAction, type CreateProjectFormState } from "@/lib/projects/actions";

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="text-xs text-destructive">{message}</p> : null;

export const NewProjectForm = () => {
  const [state, formAction, isPending] = useActionState<CreateProjectFormState, FormData>(createProjectAction, {});
  const [lotWidth, setLotWidth] = useState(state.values?.lotWidth ?? "20");
  const [lotDepth, setLotDepth] = useState(state.values?.lotDepth ?? "15");
  const lotArea = Number(lotWidth) * Number(lotDepth);

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="grid gap-5 pt-6">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Nom du projet</Label>
            <Input id="name" name="name" placeholder="Maison de Lucie" defaultValue={state.values?.name} required maxLength={120} aria-invalid={Boolean(state.errors?.name)} />
            <FieldError message={state.errors?.name} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="description">Description (optionnel)</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Plain-pied, trois chambres, garage attenant…" defaultValue={state.values?.description} maxLength={2000} />
            <FieldError message={state.errors?.description} />
          </div>
          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-medium">Terrain et construction</legend>
            <div className="grid gap-1.5">
              <Label htmlFor="lotWidth">Largeur du terrain (m)</Label>
              <Input id="lotWidth" name="lotWidth" type="number" min={1} max={500} step={0.5} value={lotWidth} onChange={(event) => setLotWidth(event.target.value)} required aria-invalid={Boolean(state.errors?.lotWidth)} />
              <FieldError message={state.errors?.lotWidth} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lotDepth">Profondeur du terrain (m)</Label>
              <Input id="lotDepth" name="lotDepth" type="number" min={1} max={500} step={0.5} value={lotDepth} onChange={(event) => setLotDepth(event.target.value)} required aria-invalid={Boolean(state.errors?.lotDepth)} />
              <FieldError message={state.errors?.lotDepth} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="wallHeight">Hauteur sous plafond (m)</Label>
              <Input id="wallHeight" name="wallHeight" type="number" min={2} max={6} step={0.05} defaultValue={state.values?.wallHeight ?? "2.7"} required aria-invalid={Boolean(state.errors?.wallHeight)} />
              <FieldError message={state.errors?.wallHeight} />
            </div>
          </fieldset>
          <p className="text-sm text-muted-foreground">
            Surface du terrain : <span className="font-medium text-foreground">{Number.isFinite(lotArea) ? formatArea(lotArea) : "…"}</span>
          </p>
          <FieldError message={state.errors?.form} />
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
            Créer et ouvrir l&apos;éditeur
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};
