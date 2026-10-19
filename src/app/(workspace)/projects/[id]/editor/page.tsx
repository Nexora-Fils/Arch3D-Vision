import type { Metadata } from "next";
import { PlanEditor } from "@/features/editor-2d/plan-editor";

export const metadata: Metadata = { title: "Éditeur 2D" };

/** These screens render the plan hydrated from PostgreSQL on the client: navigating into them is allowed to block. */
export const instant = false;

export default function EditorPage() {
  return <PlanEditor />;
}
