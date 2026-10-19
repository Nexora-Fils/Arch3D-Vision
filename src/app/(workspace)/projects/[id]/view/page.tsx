import type { Metadata } from "next";
import { HouseViewer } from "@/features/viewer-3d/house-viewer";

export const metadata: Metadata = { title: "Vue 3D" };

/** These screens render the plan hydrated from PostgreSQL on the client: navigating into them is allowed to block. */
export const instant = false;

export default function ViewPage() {
  return <HouseViewer />;
}
