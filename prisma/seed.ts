import "dotenv/config";
import { buildDemoPlan } from "../src/domain/plan/demo";
import { floorArea, formatArea, habitableArea, isOutdoorRoom } from "../src/domain/plan/geometry";
import { prisma } from "../src/lib/prisma";
import { ensureProjectBySlug } from "../src/lib/projects/repository";

/**
 * Descriptions written by earlier versions of the seed. The demo description is
 * refreshed only when it still holds one of them word for word: a description
 * edited by the user is never overwritten.
 */
const LEGACY_DEMO_DESCRIPTIONS = [
  "Maison contemporaine de 192 m² sur deux niveaux, terrain de 300 m² : séjour ouvert sur la cuisine, la terrasse et la piscine, bureau, garage et carport, trois chambres, deux salles de bain, toit plat à grand débord, parement pierre, bardage bois et grandes baies vitrées.",
];

const main = async () => {
  const reset = process.env.SEED_RESET === "1";
  const demo = buildDemoPlan();
  const result = await ensureProjectBySlug(demo, { reset });
  const status = result.created ? "créé" : result.reset ? "réinitialisé" : "déjà présent (aucune modification)";
  const area = demo.floors.reduce((sum, floor) => sum + floorArea({ ...floor, rooms: floor.rooms.filter((room) => !isOutdoorRoom(room)) }), 0);
  console.log(`Projet « ${demo.name} » : ${status}`);
  console.log(`  id            : ${result.plan.id}`);
  console.log(`  terrain       : ${demo.lot.width} × ${demo.lot.depth} m = ${demo.lot.width * demo.lot.depth} m²`);
  const roomCount = demo.floors.reduce((sum, floor) => sum + floor.rooms.length, 0);
  console.log(`  surface pièces: ${area.toFixed(2)} m² (${roomCount} pièces sur ${demo.floors.length} niveaux)`);
  console.log(`  habitable     : ${formatArea(habitableArea(demo.floors.flatMap((floor) => floor.rooms)))} (garage et extérieurs exclus)`);
  if (!result.created && !reset) {
    const { count } = await prisma.project.updateMany({ where: { id: result.plan.id, description: { in: LEGACY_DEMO_DESCRIPTIONS } }, data: { description: demo.description } });
    if (count > 0) console.log("  description   : ancienne surface (192 m²) remplacée par la surface habitable");
  }
  if (!result.created && !reset) {
    console.log("  Astuce : SEED_RESET=1 pnpm db:seed pour restaurer le plan d'origine.");
  }
};

main()
  .catch((error) => {
    console.error("Échec du seed :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
