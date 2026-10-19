import type { Metadata } from "next";
import { Walkthrough } from "@/features/walkthrough/walkthrough";

export const metadata: Metadata = { title: "Visite intérieure" };

/** These screens render the plan hydrated from PostgreSQL on the client: navigating into them is allowed to block. */
export const instant = false;

export default function WalkPage() {
  return <Walkthrough />;
}
