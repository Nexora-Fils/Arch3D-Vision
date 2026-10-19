# HomePlan 3D

Application web de conception architecturale : dessinez le plan d'une maison en 2D, générez sa représentation 3D et visitez-la de l'intérieur. Les projets sont enregistrés dans PostgreSQL.

**Stack** : Next.js 16 (App Router, Cache Components), TypeScript strict, Tailwind CSS 4, shadcn/ui, Prisma 7 + PostgreSQL (Docker Desktop), React Three Fiber + drei, React Konva, Zustand, Zod, Lucide.

## Démarrage rapide

```bash
pnpm install                 # dépendances (pnpm uniquement)
cp .env.example .env         # puis changez POSTGRES_PASSWORD et DATABASE_URL
pnpm db:up                   # PostgreSQL dans Docker Desktop (port 5433 par défaut)
pnpm db:migrate              # applique les migrations Prisma (génère aussi le client)
pnpm db:seed                 # crée « Maison familiale moderne » (idempotent)
pnpm dev                     # http://localhost:3000 (ou 3001 si le port est pris)
```

Next.js tourne sur la machine hôte, PostgreSQL dans Docker. Le port hôte de Postgres est `POSTGRES_PORT` (5433 par défaut, car 5432 est souvent déjà utilisé).

## Commandes

| But | Commande |
|---|---|
| Serveur de développement | `pnpm dev` |
| Build / démarrage production | `pnpm build` puis `pnpm start` |
| Lint / types / tests | `pnpm lint` · `pnpm typecheck` · `pnpm test` |
| Démarrer / arrêter PostgreSQL | `pnpm db:up` · `pnpm db:down` |
| Journaux PostgreSQL | `pnpm db:logs` |
| Migration de développement | `pnpm db:migrate` (`prisma migrate dev`) |
| Migration en production | `pnpm db:migrate:deploy` |
| Régénérer le client Prisma | `pnpm db:generate` |
| Données de démonstration | `pnpm db:seed` (ajoutez `SEED_RESET=1` pour restaurer le plan d'origine) |
| Prisma Studio | `pnpm db:studio` |
| Réinitialiser la base (destructif, demande confirmation) | `pnpm db:reset` |

`pnpm db:down` conserve le volume `homeplan3d_pgdata`. Ne lancez jamais `docker compose down -v` sans l'avoir décidé explicitement : cela efface les données.

## Variables d'environnement

Voir `.env.example`. Aucun secret n'est versionné : `.env` est ignoré par git.

| Variable | Rôle |
|---|---|
| `POSTGRES_PORT` | Port hôte exposé par le conteneur |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | Base et utilisateur dédiés |
| `DATABASE_URL` | Chaîne de connexion utilisée par Prisma (doit refléter les valeurs ci-dessus) |

## Architecture

```
prisma/schema.prisma            modèle relationnel (projets, étages, pièces, murs, portes, fenêtres, meubles, matériaux)
prisma/seed.ts                  projet de démonstration, reproductible
src/domain/plan/                modèle métier pur, en mètres
  schema.ts                     schémas Zod = source unique des types
  geometry.ts                   surfaces, murs fusionnés, ouvertures, collisions
  demo.ts / factory.ts          constructeurs de plans
src/store/                      Zustand : plan + annuler/rétablir, état de l'éditeur, état de la 3D
src/lib/prisma.ts               client Prisma (adaptateur pg), côté serveur uniquement
src/lib/projects/repository.ts  lecture/écriture des plans (transaction de remplacement)
src/lib/projects/actions.ts     Server Actions (création, suppression, démo)
src/app/api/projects/           API REST validée par Zod (GET/POST, GET/PUT/DELETE)
src/features/editor-2d/         éditeur React Konva
src/features/viewer-3d/         moteur React Three Fiber (murs extrudés, toiture, meubles)
src/features/walkthrough/       visite à la première personne (collisions, tactile)
```

### Source de vérité géométrique

- Le plan (`Plan`) est le seul modèle : coordonnées en mètres, angles en degrés.
- L'éditeur 2D applique l'échelle pixels/mètre sur le `Stage` Konva ; les formes restent en mètres.
- Le moteur 3D convertit dans `features/viewer-3d/convert.ts` (x → x, y du plan → z, hauteur → y).
- Les murs d'une pièce sont des entités attachées (`roomId` + côté) : déplacer ou redimensionner la pièce les met à jour. Les murs partagés par deux pièces sont fusionnés par `buildWallSegments` avant le rendu 3D et les collisions, ce qui évite les chevauchements.
- Les portes et fenêtres référencent un mur et une distance depuis son origine ; elles sont reprojetées sur le mur fusionné.

### Choix de modélisation (Prisma)

- Une table par entité architecturale, avec intégrité référentielle et suppressions en cascade.
- Géométrie en colonnes `Float` (mètres), paramètres de projet en `Json` validé par Zod (`settings`), colonne `polygon` réservée aux pièces non rectangulaires.
- Identifiants UUID générés côté client : un élément garde son identité à chaque sauvegarde.
- Sauvegarde = remplacement transactionnel du plan complet (`replaceProjectPlan`).
- `Project.ownerId` nullable : prêt pour l'authentification.

## Écrans

| Route | Contenu |
|---|---|
| `/` | Landing : photo d'architecture (licence Unsplash), « Voir la vidéo » (enregistrement réel de la vue 3D), six fonctionnalités, parcours plan → 3D → visite et vitrine en rendus réels de l'application, bandeau d'appel à l'action, version mobile |
| `/dashboard`, `/projects` | « Bonjour, prénom ! », projets récents (vignette = capture du rendu 3D réel enregistrée en base), modèles disponibles ; barre latérale avec « Mon compte », barre d'onglets mobile |
| `/templates` | Cinq modèles de maisons (contemporaine, traditionnelle, minimaliste, familiale, petite) : chaque carte crée un projet indépendant |
| `/settings` | État de l'application : base de données (version, compteurs), pile technique |
| `/projects/[id]/editor` | Éditeur 2D : Sélection, Mur, Pièce, Porte, Fenêtre, Escalier, Texte, Cotation, Meuble, Supprimer ; cotes générales, échelle graphique, sols et gazon texturés, panneau Propriétés ; barre Annuler / Rétablir / Enregistrer / Exporter (PNG) / Aperçu 3D / Visite intérieure |
| `/projects/[id]/view` | Vue 3D plein écran : panneau Matériaux (Murs, Sols, Toiture, Bois, Métal, Pierre), modes Extérieur / Intérieur (coupe) / Vue aérienne / Visite, Jour / Soir, points de vue, tour automatique, téléchargement, partage, options avancées |
| `/projects/[id]/walk` | Visite plein écran : pièce courante, étages, touches Z / S / Q / D, rotation, joystick tactile, minicarte cliquable, Jour / Soir, plein écran, Quitter la visite |
| `/a-propos` | Présentation du projet |
| `/projects/[id]/settings` | Paramètres du projet, bibliothèque de matériaux, suppression |
| `/tarifs`, `/connexion`, `/inscription` | Pages de présentation ; l'authentification n'est pas encore implémentée |

## Annotations et profil

- Chaque étage stocke ses annotations (textes libres et cotes mesurées) dans la colonne `Floor.annotations` (JSON validé par Zod, migration `floor_annotations`).
- Sans authentification, le prénom et l'e-mail affichés (« Bonjour, … », « Mon compte ») sont saisis dans `/settings` et conservés dans deux cookies `httpOnly`.

## Projet de démonstration

« Maison familiale moderne » : terrain 20 × 15 m (300 m²), maison contemporaine sur deux niveaux. Rez-de-chaussée 12 × 9 m (108 m²) : séjour ouvert sur la cuisine, bureau, entrée, buanderie, toilettes, cellier, garage. Étage 12 × 7 m (84 m²) en retrait avec terrasse : trois chambres, salle de bain, salle d'eau, dressing, palier et couloir. Toit terrasse, enduit blanc et bardage bois, 17 portes, 20 fenêtres, 33 meubles. Les tests vérifient les surfaces (108 + 84 m²), la validité des ouvertures et le style contemporain.

Si la démo existait déjà dans votre base (ancienne version), restaurez-la : `SEED_RESET=1 pnpm db:seed`.

## Rendu 3D

- Éclairage par image : deux environnements HDR réels (ciel de jour, coucher de soleil ; CC0 Poly Haven, dans `public/hdri/`) pour la lumière ambiante, les reflets et le fond de ciel, soleil directionnel à ombres douces (PCSS).
- Post-traitement (`@react-three/postprocessing`) en qualité Élevée : occlusion ambiante, lueur des luminaires, tone mapping AgX, anticrénelage SMAA, vignettage.
- Textures photographiques PBR (couleur, normales, rugosité ; CC0 Poly Haven, `public/textures/`) pour parquet, lames de terrasse, bardage, enduit, parement pierre, tuiles, ardoise, béton, dallage, carrelage, gazon, gravier et lin. Chaque texture est recolorée vers la couleur du matériau (moyenne de l'image), la couleur reste donc modifiable.
- Mobilier et végétation scannés (GLB CC0, `public/models/`, 9,6 Mo) ajustés aux cotes du plan : fauteuil, chaises, tables, tabouret, plantes en pot, meuble TV, suspension, vase, massifs fleuris, arbustes, graminées. Canapés et lits en volumes arrondis habillés de lin.
- Finitions : plinthes, appuis de fenêtre intérieurs et extérieurs, encadrements et poignées, soubassement, sous-face et bandeaux de toiture, garde-corps vitrés sur les terrasses d'étage, baies coulissantes.
- Un mur dont le matériau est de type « Façade » (par exemple « Bardage bois ») affiche ce matériau côté extérieur ; l'intérieur reste en enduit.
- Pièces extérieures : « Terrasse » (dalle meublable), « Piscine » (bassin carrelé, margelle, eau réfléchissante), « Carport » (dalle et pergola bois).
- Toiture : cheminée et gouttières sur les toits en pente, option panneaux solaires sur le versant sud, bandeaux et sous-face.
- Mode Jour / Soir : ciel, soleil, exposition, suspensions et lampadaires allumés, vitrages lumineux vus de l'extérieur.
- Environnement : reflets (drei `Environment` + `Lightformer`), haies continues, trois essences d'arbres, arbustes, allées depuis chaque porte extérieure, bordure de terrain.
- Autres meubles en primitives proportionnées : armoire, cuisine, baignoire, douche, lavabo, WC, bureau, escalier, tableau, lampadaire, parasol, tapis ; mobilier extérieur en primitives.
- Performance : rendu à la demande en vue extérieure (`frameloop="demand"`), niveaux de qualité Automatique / Économique / Élevée (résolution, ombres, environnement), lumières limitées au niveau visité, géométries et matériaux libérés au démontage.

## Modèles

`src/domain/plan/templates/` : un générateur commun (`buildPlanFromSpec`) et cinq spécifications déclaratives (pièces, portes, fenêtres, meubles, matériaux). `scripts/template-projects.ts create|delete` crée ou retire un projet par modèle pour les inspecter.

## Limitations connues

- Pièces rectangulaires uniquement (la colonne `polygon` et le type `Room.polygon` préparent les polygones).
- Pas d'escalier entre étages : la visite se fait étage par étage.
- Les meubles ne bloquent pas le visiteur.
- Pas d'authentification : tous les projets sont visibles par tous.
- La 3D n'est pas testée automatiquement (WebGL) ; les tests couvrent la géométrie, le schéma et le projet de démonstration.
