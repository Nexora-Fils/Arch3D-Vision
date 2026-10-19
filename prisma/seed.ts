import "dotenv/config";
import { buildDemoPlan } from "../src/domain/plan/demo";
import { floorArea, isOutdoorRoom } from "../src/domain/plan/geometry";
import { prisma } from "../src/lib/prisma";
import { ensureProjectBySlug } from "../src/lib/projects/repository";

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
