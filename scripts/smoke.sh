#!/bin/bash
# Usage: scripts/smoke.sh [http://localhost:3000]  (serveur Next.js démarré, démo seedée)
# End-to-end smoke test: pages render, accounts and sessions work, the API enforces
# project ownership (401 / 403) and PostgreSQL persists.
# The demo id is deterministic on a fresh database; an older one keeps its first id:
#   DEMO_ID=demo-project-maison-familiale-moderne pnpm test:e2e
BASE="${1:-http://localhost:3000}"
DEMO_ID="${DEMO_ID:-demo-project-contemporaine}"
OWNER_JAR=/tmp/hp3d_owner.jar
OTHER_JAR=/tmp/hp3d_other.jar
OWNER_EMAIL="e2e-owner@homeplan.test"
OTHER_EMAIL="e2e-other@homeplan.test"
PASSWORD="e2e-password-123"
RUN=$(date +%s)
rm -f "$OWNER_JAR" "$OTHER_JAR"
fail=0
check() { # label expected actual
  if [ "$2" = "$3" ]; then echo "  ok   $1 ($3)"; else echo "  FAIL $1 (attendu $2, obtenu $3)"; fail=1; fi
}
contains() { # label file text
  if grep -q "$3" "$2"; then echo "  ok   $1"; else echo "  FAIL $1"; fail=1; fi
}
# api <jar|-> <method> <path> [json body or @file] -> HTTP status; the response is in /tmp/hp3d_body.json
api() {
  local args=(-s -o /tmp/hp3d_body.json -w "%{http_code}" -X "$2")
  [ "$1" != "-" ] && args+=(-b "$1" -c "$1")
  [ -n "$4" ] && args+=(-H "Content-Type: application/json" --data-binary "$4")
  curl "${args[@]}" "$BASE$3"
}
page() { curl -s -L -o /tmp/hp3d_page.html -w "%{http_code}" "${@:2}" "$BASE$1"; }
signup() { api "$1" POST /api/auth/signup "{\"name\":\"$2\",\"email\":\"$3\",\"password\":\"$4\"}"; }
login() { api "$1" POST /api/auth/login "{\"email\":\"$2\",\"password\":\"$3\"}"; }

echo "== Pages publiques (sans compte)"
for path in / /templates /tarifs /connexion /inscription /a-propos "/projects/$DEMO_ID/editor" "/projects/$DEMO_ID/view" "/projects/$DEMO_ID/walk" "/projects/$DEMO_ID/settings" "/projects/$DEMO_ID"; do
  check "GET $path" 200 "$(page "$path")"
done
page /templates >/dev/null; contains "modèles : modèle disponible" /tmp/hp3d_page.html "Utiliser ce modèle"
page /projects/inconnu/editor >/dev/null; contains "projet inconnu affiche la page introuvable" /tmp/hp3d_page.html "Page ou projet introuvable"

echo "== Pages privées sans session : redirection vers la connexion"
for path in /dashboard /projects /projects/new /settings; do
  next=$(node -p 'encodeURIComponent(process.argv[1])' "$path")
  check "GET $path" "307 $BASE/connexion?next=$next" "$(curl -s -o /dev/null -w "%{http_code} %{redirect_url}" "$BASE$path")"
done

echo "== API sans session"
check "GET démo (vitrine publique)" 200 "$(api - GET "/api/projects/$DEMO_ID")"
cp /tmp/hp3d_body.json /tmp/hp3d_plan.json
node -e '
const plan=require("/tmp/hp3d_plan.json");
const sum=(key)=>plan.floors.reduce((s,f)=>s+f[key].length,0);
const area=plan.floors.reduce((s,f)=>s+f.rooms.filter(r=>!["terrace","pool","carport"].includes(r.type)).reduce((a,r)=>a+r.width*r.depth,0),0);
console.log(`  info plan: ${plan.floors.length} niveaux, ${sum("rooms")} pièces, ${sum("walls")} murs, ${sum("doors")} portes, ${sum("windows")} fenêtres, ${sum("furniture")} meubles, surface ${area.toFixed(2)} m², terrain ${plan.lot.width*plan.lot.depth} m²`);
if (Math.abs(area-192)>1e-6) { console.log("  FAIL surface != 192"); process.exit(1); }
'
[ $? -ne 0 ] && fail=1
check "GET /api/projects → 401" 401 "$(api - GET /api/projects)"
check "POST /api/projects → 401" 401 "$(api - POST /api/projects '{"name":"x","lotWidth":10,"lotDepth":10,"wallHeight":2.5}')"
check "PUT démo → 401" 401 "$(api - PUT "/api/projects/$DEMO_ID" @/tmp/hp3d_plan.json)"
check "DELETE démo → 401" 401 "$(api - DELETE "/api/projects/$DEMO_ID")"
check "GET /api/projects/inconnu → 404" 404 "$(api - GET /api/projects/inconnu)"

echo "== Comptes et sessions"
# The test accounts survive between runs: 409 means a previous run created them.
c=$(signup "$OWNER_JAR" "E2e Propriétaire" "$OWNER_EMAIL" "$PASSWORD")
if [ "$c" = 201 ] || [ "$c" = 409 ]; then echo "  ok   inscription du propriétaire ($c)"; else echo "  FAIL inscription du propriétaire ($c)"; fail=1; fi
check "inscription avec une adresse prise → 409" 409 "$(signup - "Doublon" "$OWNER_EMAIL" "$PASSWORD")"
check "inscription invalide → 400" 400 "$(signup - "" "pas-un-email" "court")"
check "connexion, mauvais mot de passe → 401" 401 "$(login - "$OWNER_EMAIL" "mauvais-mot-de-passe")"
check "connexion du propriétaire" 200 "$(login "$OWNER_JAR" "$OWNER_EMAIL" "$PASSWORD")"
signup "$OTHER_JAR" "E2e Voisin" "$OTHER_EMAIL" "$PASSWORD" >/dev/null
check "connexion d'un autre compte" 200 "$(login "$OTHER_JAR" "$OTHER_EMAIL" "$PASSWORD")"
check "cookie de session forgé → 401" 401 "$(curl -s -o /dev/null -w "%{http_code}" -b "hp_session=forged" "$BASE/api/projects")"

echo "== Pages privées avec session"
for path in /dashboard /projects /projects/new /settings; do
  check "GET $path" 200 "$(page "$path" -b "$OWNER_JAR")"
done
page /dashboard -b "$OWNER_JAR" >/dev/null; contains "accueil : bonjour au propriétaire" /tmp/hp3d_page.html "Bonjour, E2e !"
page /settings -b "$OWNER_JAR" >/dev/null; contains "paramètres : base de données connectée" /tmp/hp3d_page.html "Connectée"

echo "== API création"
check "POST invalide → 400" 400 "$(api "$OWNER_JAR" POST /api/projects '{"name":"x","lotWidth":-1}')"
check "POST /api/projects → 201" 201 "$(api "$OWNER_JAR" POST /api/projects '{"name":"Projet e2e","lotWidth":"18","lotDepth":"12","wallHeight":"2.6","description":"créé par smoke.sh"}')"
NEW_ID=$(node -p 'require("/tmp/hp3d_body.json").id')
echo "  info nouveau projet: $NEW_ID"
check "GET /api/projects" 200 "$(api "$OWNER_JAR" GET /api/projects)"
contains "la liste du propriétaire contient le projet" /tmp/hp3d_body.json "$NEW_ID"
check "GET éditeur du nouveau projet" 200 "$(page "/projects/$NEW_ID/editor" -b "$OWNER_JAR")"

echo "== API écriture (copie de la démo dans le projet, modification d'une pièce)"
RUN=$RUN NEW_ID=$NEW_ID node -e '
const fs=require("fs");
const demo=JSON.parse(fs.readFileSync("/tmp/hp3d_plan.json","utf8"));
// Element ids are primary keys: the copy gets its own, references included.
const prefix=`e2e${process.env.RUN}-`;
const copy=(value,key)=>Array.isArray(value)?value.map((item)=>copy(item))
  :value&&typeof value==="object"?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copy(v,k)]))
  :typeof value==="string"&&(key==="id"||key?.endsWith("Id"))?prefix+value:value;
const plan={...copy(demo),id:process.env.NEW_ID,slug:null};
const room=plan.floors[0].rooms.find(r=>r.type==="kitchen");
fs.writeFileSync("/tmp/hp3d_expected.json", JSON.stringify({id:room.id,width:room.width+0.5}));
room.name="Cuisine (test e2e)"; room.width=room.width+0.5;
plan.floors[0].annotations=[{id:"e2e-dim",kind:"dimension",start:{x:1,y:1},end:{x:5,y:1},text:""},{id:"e2e-txt",kind:"text",start:{x:2,y:2},end:{x:2,y:2},text:"Jardin"}];
// keep walls consistent like the store does
const sides={north:[{x:room.x,y:room.y},{x:room.x+room.width,y:room.y}],east:[{x:room.x+room.width,y:room.y},{x:room.x+room.width,y:room.y+room.depth}],south:[{x:room.x+room.width,y:room.y+room.depth},{x:room.x,y:room.y+room.depth}],west:[{x:room.x,y:room.y+room.depth},{x:room.x,y:room.y}]};
for (const w of plan.floors[0].walls) if (w.roomId===room.id) { w.start=sides[w.side][0]; w.end=sides[w.side][1]; }
fs.writeFileSync("/tmp/hp3d_modified.json", JSON.stringify(plan));
'
check "PUT plan modifié" 200 "$(api "$OWNER_JAR" PUT "/api/projects/$NEW_ID" @/tmp/hp3d_modified.json)"
cat /tmp/hp3d_body.json; echo
check "GET après PUT" 200 "$(api "$OWNER_JAR" GET "/api/projects/$NEW_ID")"
node -e '
const plan=require("/tmp/hp3d_body.json");
const expected=require("/tmp/hp3d_expected.json");
const room=plan.floors[0].rooms.find(r=>r.id===expected.id);
const wall=plan.floors[0].walls.find(w=>w.roomId===room?.id && w.side==="east");
if (!room || room.name!=="Cuisine (test e2e)" || Math.abs(room.width-expected.width)>1e-9) { console.log("  FAIL modification non persistée", room); process.exit(1); }
if (Math.abs(wall.start.x-(room.x+room.width))>1e-9) { console.log("  FAIL mur non persisté", wall); process.exit(1); }
const notes=plan.floors[0].annotations||[];
if (notes.length!==2 || !notes.some(n=>n.kind==="dimension") || !notes.some(n=>n.text==="Jardin")) { console.log("  FAIL annotations non persistées", notes); process.exit(1); }
console.log("  ok   modification persistée en base (nom, largeur "+expected.width+" m, mur est à x="+wall.start.x+", 2 annotations)");
'
[ $? -ne 0 ] && fail=1

echo "== API validation"
# Built outside "$(...)": bash 3.2 would brace-expand {"id":…,"name":…} into two arguments.
INVALID_PLAN="{\"id\":\"$NEW_ID\",\"name\":\"\"}"
check "PUT payload invalide → 400" 400 "$(api "$OWNER_JAR" PUT "/api/projects/$NEW_ID" "$INVALID_PLAN")"
head -c 200 /tmp/hp3d_body.json; echo
check "PUT id incohérent → 400" 400 "$(api "$OWNER_JAR" PUT "/api/projects/$NEW_ID" @/tmp/hp3d_plan.json)"
c=$(curl -s -o /dev/null -w "%{http_code}" -b "$OWNER_JAR" -X PUT -H "Content-Type: text/plain" --data-binary @/tmp/hp3d_modified.json "$BASE/api/projects/$NEW_ID"); check "PUT sans Content-Type JSON → 400" 400 "$c"

echo "== Propriété des projets"
check "PUT démo par un compte → 403" 403 "$(api "$OWNER_JAR" PUT "/api/projects/$DEMO_ID" @/tmp/hp3d_plan.json)"
check "DELETE démo par un compte → 403" 403 "$(api "$OWNER_JAR" DELETE "/api/projects/$DEMO_ID")"
check "GET projet d'un autre compte → 403" 403 "$(api "$OTHER_JAR" GET "/api/projects/$NEW_ID")"
check "PUT projet d'un autre compte → 403" 403 "$(api "$OTHER_JAR" PUT "/api/projects/$NEW_ID" @/tmp/hp3d_modified.json)"
check "DELETE projet d'un autre compte → 403" 403 "$(api "$OTHER_JAR" DELETE "/api/projects/$NEW_ID")"
check "GET projet privé sans session → 401" 401 "$(api - GET "/api/projects/$NEW_ID")"
api "$OTHER_JAR" GET /api/projects >/dev/null
if grep -q "$NEW_ID" /tmp/hp3d_body.json; then echo "  FAIL la liste d'un autre compte contient le projet"; fail=1; else echo "  ok   la liste d'un autre compte ne contient pas le projet"; fi
page "/projects/$NEW_ID/editor" -b "$OTHER_JAR" >/dev/null; contains "éditeur du projet d'un autre compte : page introuvable" /tmp/hp3d_page.html "Page ou projet introuvable"

echo "== API miniature"
TINY_JPEG="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
check "PUT miniature JPEG → 200" 200 "$(api "$OWNER_JAR" PUT "/api/projects/$NEW_ID/thumbnail" "{\"dataUrl\":\"$TINY_JPEG\"}")"
check "PUT miniature PNG → 400" 400 "$(api "$OWNER_JAR" PUT "/api/projects/$NEW_ID/thumbnail" '{"dataUrl":"data:image/png;base64,AAAA"}')"
check "PUT miniature projet inconnu → 404" 404 "$(api "$OWNER_JAR" PUT /api/projects/inconnu/thumbnail "{\"dataUrl\":\"$TINY_JPEG\"}")"
check "PUT miniature d'un autre compte → 403" 403 "$(api "$OTHER_JAR" PUT "/api/projects/$NEW_ID/thumbnail" "{\"dataUrl\":\"$TINY_JPEG\"}")"
check "PUT miniature de la démo → 403" 403 "$(api "$OWNER_JAR" PUT "/api/projects/$DEMO_ID/thumbnail" "{\"dataUrl\":\"$TINY_JPEG\"}")"

echo "== API suppression"
check "DELETE → 204" 204 "$(api "$OWNER_JAR" DELETE "/api/projects/$NEW_ID")"
check "GET après DELETE → 404" 404 "$(api "$OWNER_JAR" GET "/api/projects/$NEW_ID")"
check "DELETE inexistant → 404" 404 "$(api "$OWNER_JAR" DELETE "/api/projects/$NEW_ID")"

echo
if [ $fail -eq 0 ]; then echo "SMOKE OK"; else echo "SMOKE FAILED"; exit 1; fi
