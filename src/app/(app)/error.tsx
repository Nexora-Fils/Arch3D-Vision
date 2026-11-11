"use client";

import { DataLoadError } from "@/components/data-load-error";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <DataLoadError error={error} onRetry={retry} />;
}
