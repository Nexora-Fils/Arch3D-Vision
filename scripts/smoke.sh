#!/bin/bash
# Usage: scripts/smoke.sh [http://localhost:3000]  (serveur Next.js démarré, démo seedée)
# End-to-end smoke test: pages render, API validates, PostgreSQL persists.
BASE="${1:-http://localhost:3000}"
# The seed keeps the id of an existing demo: look it up by its stable slug.
DEMO_ID=$(curl -s "$BASE/api/projects" | node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).find((p) => p.slug === "maison-familiale-moderne")?.id')
fail=0
check() { # label expected actual
  if [ "$2" = "$3" ]; then echo "  ok   $1 ($3)"; else echo "  FAIL $1 (attendu $2, obtenu $3)"; fail=1; fi
}
code() { curl -s -o "$2" -w "%{http_code}" "$1"; }

echo "== Pages"
for path in / /dashboard /projects /projects/new /templates /settings /tarifs /connexion /inscription /a-propos "/projects/$DEMO_ID/editor" "/projects/$DEMO_ID/view" "/projects/$DEMO_ID/walk" "/projects/$DEMO_ID/settings" "/projects/$DEMO_ID"; do
  out=/tmp/hp3d_page.html
  c=$(curl -s -L -o $out -w "%{http_code}" "$BASE$path")
  check "GET $path" 200 "$c"
done
grep -q "Maison familiale moderne" <(curl -s "$BASE/dashboard") && echo "  ok   dashboard liste la démo" || { echo "  FAIL dashboard sans démo"; fail=1; }
grep -q "Connectée" <(curl -s "$BASE/settings") && echo "  ok   paramètres : base de données connectée" || { echo "  FAIL paramètres sans statut base"; fail=1; }
grep -q "Utiliser ce modèle" <(curl -s "$BASE/templates") && echo "  ok   modèles : modèle disponible" || { echo "  FAIL page modèles"; fail=1; }
grep -q "Page ou projet introuvable" <(curl -s "$BASE/projects/inconnu/editor") && echo "  ok   projet inconnu affiche la page introuvable" || { echo "  FAIL projet inconnu sans page introuvable"; fail=1; }

echo "== API lecture"
c=$(code "$BASE/api/projects" /tmp/hp3d_list.json); check "GET /api/projects" 200 "$c"
c=$(code "$BASE/api/projects/$DEMO_ID" /tmp/hp3d_plan.json); check "GET /api/projects/:id" 200 "$c"
node -e '
const plan=require("/tmp/hp3d_plan.json");
const sum=(key)=>plan.floors.reduce((s,f)=>s+f[key].length,0);
const area=plan.floors.reduce((s,f)=>s+f.rooms.filter(r=>!["terrace","pool","carport"].includes(r.type)).reduce((a,r)=>a+r.width*r.depth,0),0);
console.log(`  info plan: ${plan.floors.length} niveaux, ${sum("rooms")} pièces, ${sum("walls")} murs, ${sum("doors")} portes, ${sum("windows")} fenêtres, ${sum("furniture")} meubles, surface ${area.toFixed(2)} m², terrain ${plan.lot.width*plan.lot.depth} m²`);
if (Math.abs(area-192)>1e-6) { console.log("  FAIL surface != 192"); process.exit(1); }
'
[ $? -ne 0 ] && fail=1
c=$(code "$BASE/api/projects/inconnu" /dev/null); check "GET /api/projects/inconnu → 404" 404 "$c"

echo "== API écriture (modifier une pièce de la démo puis restaurer)"
node -e '
const fs=require("fs");
const plan=JSON.parse(fs.readFileSync("/tmp/hp3d_plan.json","utf8"));
const room=plan.floors[0].rooms.find(r=>r.id==="demo-room-cuisine");
fs.writeFileSync("/tmp/hp3d_expected_width.txt", String(room.width+0.5));
room.name="Cuisine (test e2e)"; room.width=room.width+0.5;
plan.floors[0].annotations=[{id:"e2e-dim",kind:"dimension",start:{x:1,y:1},end:{x:5,y:1},text:""},{id:"e2e-txt",kind:"text",start:{x:2,y:2},end:{x:2,y:2},text:"Jardin"}];
// keep walls consistent like the store does
const sides={north:[{x:room.x,y:room.y},{x:room.x+room.width,y:room.y}],east:[{x:room.x+room.width,y:room.y},{x:room.x+room.width,y:room.y+room.depth}],south:[{x:room.x+room.width,y:room.y+room.depth},{x:room.x,y:room.y+room.depth}],west:[{x:room.x,y:room.y+room.depth},{x:room.x,y:room.y}]};
for (const w of plan.floors[0].walls) if (w.roomId===room.id) { w.start=sides[w.side][0]; w.end=sides[w.side][1]; }
fs.writeFileSync("/tmp/hp3d_modified.json", JSON.stringify(plan));
'
c=$(curl -s -o /tmp/hp3d_put.json -w "%{http_code}" -X PUT -H "Content-Type: application/json" --data-binary @/tmp/hp3d_modified.json "$BASE/api/projects/$DEMO_ID"); check "PUT plan modifié" 200 "$c"
cat /tmp/hp3d_put.json; echo
c=$(code "$BASE/api/projects/$DEMO_ID" /tmp/hp3d_after.json); check "GET après PUT" 200 "$c"
node -e '
const plan=require("/tmp/hp3d_after.json");
const expected=Number(require("fs").readFileSync("/tmp/hp3d_expected_width.txt","utf8"));
const room=plan.floors[0].rooms.find(r=>r.id==="demo-room-cuisine");
const wall=plan.floors[0].walls.find(w=>w.roomId===room.id && w.side==="east");
if (room.name!=="Cuisine (test e2e)" || Math.abs(room.width-expected)>1e-9) { console.log("  FAIL modification non persistée", room); process.exit(1); }
if (Math.abs(wall.start.x-(room.x+room.width))>1e-9) { console.log("  FAIL mur non persisté", wall); process.exit(1); }
const notes=plan.floors[0].annotations||[];
if (notes.length!==2 || !notes.some(n=>n.kind==="dimension") || !notes.some(n=>n.text==="Jardin")) { console.log("  FAIL annotations non persistées", notes); process.exit(1); }
console.log("  ok   modification persistée en base (nom, largeur "+expected+" m, mur est à x="+wall.start.x+", 2 annotations)");
'
[ $? -ne 0 ] && fail=1
echo "  -> restauration du plan d'origine"
c=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Content-Type: application/json" --data-binary @/tmp/hp3d_plan.json "$BASE/api/projects/$DEMO_ID"); check "PUT restauration" 200 "$c"

echo "== API validation"
c=$(curl -s -o /tmp/hp3d_bad.json -w "%{http_code}" -X PUT -H "Content-Type: application/json" -d '{"id":"'$DEMO_ID'","name":""}' "$BASE/api/projects/$DEMO_ID"); check "PUT payload invalide → 400" 400 "$c"
head -c 200 /tmp/hp3d_bad.json; echo
c=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Content-Type: application/json" --data-binary @/tmp/hp3d_plan.json "$BASE/api/projects/autre-id"); check "PUT id incohérent → 400" 400 "$c"
c=$(curl -s -o /tmp/hp3d_badpost.json -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"name":"x","lotWidth":-1}' "$BASE/api/projects"); check "POST invalide → 400" 400 "$c"

echo "== API création / suppression"
c=$(curl -s -o /tmp/hp3d_created.json -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"name":"Projet e2e","lotWidth":"18","lotDepth":"12","wallHeight":"2.6","description":"créé par smoke.sh"}' "$BASE/api/projects"); check "POST /api/projects → 201" 201 "$c"
NEW_ID=$(node -e 'console.log(require("/tmp/hp3d_created.json").id)')
echo "  info nouveau projet: $NEW_ID"
c=$(code "$BASE/projects/$NEW_ID/editor" /dev/null); check "GET éditeur du nouveau projet" 200 "$c"
echo "== API miniature"
TINY_JPEG="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
c=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Content-Type: application/json" -d "{\"dataUrl\":\"$TINY_JPEG\"}" "$BASE/api/projects/$NEW_ID/thumbnail"); check "PUT miniature JPEG → 200" 200 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Content-Type: application/json" -d '{"dataUrl":"data:image/png;base64,AAAA"}' "$BASE/api/projects/$NEW_ID/thumbnail"); check "PUT miniature PNG → 400" 400 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Content-Type: application/json" -d "{\"dataUrl\":\"$TINY_JPEG\"}" "$BASE/api/projects/inconnu/thumbnail"); check "PUT miniature projet inconnu → 404" 404 "$c"

c=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/projects/$NEW_ID"); check "DELETE → 204" 204 "$c"
c=$(code "$BASE/api/projects/$NEW_ID" /dev/null); check "GET après DELETE → 404" 404 "$c"
c=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/projects/$NEW_ID"); check "DELETE inexistant → 404" 404 "$c"

echo
if [ $fail -eq 0 ]; then echo "SMOKE OK"; else echo "SMOKE FAILED"; exit 1; fi
