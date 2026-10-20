"use client";

import { Color } from "three";
import type { Material } from "@/domain/plan/schema";
import type { PhotoKey } from "@/features/viewer-3d/photo-textures";

const hasKeyword = (name: string, keywords: string[]) => {
  const lower = name.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
};

/** Picks the photographic texture of a library material from its name, then from its color. */
export const photoForMaterial = (material: Material): PhotoKey => {
  const name = material.name;
  const { h, s, l } = new Color(material.color).getHSL({ h: 0, s: 0, l: 0 });
  const isWoody = h >= 0.04 && h <= 0.12 && s > 0.32 && l < 0.68;
  switch (material.kind) {
    case "floor":
      if (hasKeyword(name, ["lames", "terrasse", "deck"])) return "deck";
      if (hasKeyword(name, ["parquet", "bois", "chêne"])) return "laminate";
      if (hasKeyword(name, ["pierre", "dalle"])) return "patio";
      if (hasKeyword(name, ["béton", "ciment"])) return "concrete";
      if (hasKeyword(name, ["carrelage", "faïence"])) return l > 0.7 ? "whiteTiles" : "greyTiles";
      return isWoody ? "laminate" : "greyTiles";
    case "exterior":
      if (hasKeyword(name, ["béton", "beton", "banché"])) return "concreteWall";
      if (hasKeyword(name, ["enduit", "crépi", "peinture"])) return "plaster";
      if (hasKeyword(name, ["bardage", "bois"])) return "cladding";
      if (hasKeyword(name, ["pierre", "parement", "brique", "moellon"])) return "sandstone";
      return isWoody ? "cladding" : "plaster";
    case "roof":
      if (hasKeyword(name, ["terrasse", "gravier", "gravillon"])) return "gravel";
      if (hasKeyword(name, ["anthracite", "ardoise", "zinc"])) return "slateTiles";
      if (hasKeyword(name, ["tuile"])) return h < 0.1 && s > 0.3 ? "clayTiles" : "slateTiles";
      if (h < 0.1 && s > 0.3) return "clayTiles";
      return l < 0.45 ? "slateTiles" : "gravel";
    case "wall":
    default:
      return "plaster";
  }
};
