"use client";

import { DataLoadError } from "@/components/data-load-error";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DataLoadError error={error} onRetry={reset} />;
}
