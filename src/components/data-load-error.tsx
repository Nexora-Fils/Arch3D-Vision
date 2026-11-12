"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DataLoadErrorProps {
  error: Error & { digest?: string };
  onRetry: () => void;
}

export const DataLoadError = ({ error, onRetry }: DataLoadErrorProps) => (
  <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-xl border bg-background p-8 text-center">
    <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
      <TriangleAlert className="size-6" aria-hidden />
    </span>
    <h1 className="text-lg font-semibold">Impossible de charger les données</h1>
    <p className="text-sm text-muted-foreground">
      La base de données ne répond pas. Vérifiez que PostgreSQL est démarré avec{" "}
      <code className="rounded bg-muted px-1">pnpm db:up</code>, puis réessayez.
    </p>
    {error.digest ? <p className="text-xs text-muted-foreground">Référence : {error.digest}</p> : null}
    <Button onClick={onRetry}>Réessayer</Button>
  </div>
);
