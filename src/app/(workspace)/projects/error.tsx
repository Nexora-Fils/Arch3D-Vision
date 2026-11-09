"use client";

import { DataLoadError } from "@/components/data-load-error";

export default function ProjectsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-6">
      <DataLoadError error={error} onRetry={retry} />
    </div>
  );
}
