import type { StaticImageData } from "next/image";
import duplexHouse from "@/assets/images/templates/detailed/duplex-house.jpg";
import greenResidence from "@/assets/images/templates/detailed/green-residence.jpg";
import villaAalsmeer from "@/assets/images/templates/detailed/villa-aalsmeer.jpg";

/** Real renders of each detailed model, captured from its 3D view in the application. */
export const DETAILED_IMAGES: Record<string, StaticImageData> = {
  "villa-aalsmeer": villaAalsmeer,
  "duplex-house": duplexHouse,
  "green-residence": greenResidence,
};
