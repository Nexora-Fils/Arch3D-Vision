import type { Metadata } from "next";
import { ProjectSettings } from "@/features/settings/project-settings";

export const metadata: Metadata = { title: "Paramètres du projet" };

/** These screens render the plan hydrated from PostgreSQL on the client: navigating into them is allowed to block. */
export const instant = false;

export default function SettingsPage() {
  return <ProjectSettings />;
}
