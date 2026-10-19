import type { StaticImageData } from "next/image";
import contemporaine from "@/assets/images/templates/contemporaine.jpg";
import familiale from "@/assets/images/templates/familiale.jpg";
import minimaliste from "@/assets/images/templates/minimaliste.jpg";
import petite from "@/assets/images/templates/petite.jpg";
import traditionnelle from "@/assets/images/templates/traditionnelle.jpg";

/** Real renders of each template, captured from the application's 3D view. */
export const TEMPLATE_IMAGES: Record<string, StaticImageData> = {
  contemporaine,
  traditionnelle,
  minimaliste,
  familiale,
  petite,
};
