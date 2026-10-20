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
src/features/viewer-3d/         moteur procédural React Three Fiber : la maison générée à partir du plan
  architecture/                 bibliothèque de composants paramétrables : toitures, menuiseries, volets, tableaux
  landscape/                    aménagement extérieur : pelouse, allées et bordures, haies, arbres, massifs
src/features/detailed-houses/   modèles détaillés GLB (scènes figées d'artistes, non modifiables), système indépendant
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
| `/templates` | Deux sections clairement séparées. « Plans modifiables » : cinq maisons générées à partir de leur plan (contemporaine, traditionnelle, minimaliste, familiale, petite), avec rendu réel, style, surface habitable, chambres, salles de bain, niveaux, terrain et garage calculés depuis le plan ; chaque carte crée un projet indépendant. « Modèles détaillés » : trois maquettes GLB sous licence CC BY 4.0, avec rendu réel, niveaux, emprise et hauteur mesurés, attribution |
| `/templates/detailed/[key]` | Vue 3D plein écran d'un modèle détaillé (orbite, Jour / Soir), mêmes éclairage et post-traitement que les maisons générées, attribution et licence |
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

« Maison familiale moderne » : terrain 20 × 15 m (300 m²), maison contemporaine sur deux niveaux. Rez-de-chaussée 12 × 9 m (108 m²) : séjour ouvert sur la cuisine, bureau, entrée, buanderie, toilettes, cellier, garage. Étage 12 × 7 m (84 m²) en retrait avec terrasse : trois chambres, salle de bain, salle d'eau, dressing, palier et couloir. Toit terrasse, enduit blanc et bardage bois, 17 portes, 20 fenêtres, 33 meubles. Surface habitable : 178,5 m² (192 m² de pièces intérieures moins le garage de 13,5 m² ; terrasse, piscine et carport sont des extérieurs). Les tests vérifient les surfaces (108 + 84 m²), la surface habitable annoncée par chaque modèle, la validité des ouvertures et le style contemporain.

`pnpm db:seed` (sans `SEED_RESET`) ne modifie jamais un projet existant, sauf la description de la démo lorsqu'elle est encore mot pour mot l'ancien texte « 192 m² » : elle est alors remplacée par la surface habitable.

Si la démo existait déjà dans votre base (ancienne version), restaurez-la : `SEED_RESET=1 pnpm db:seed`.

## Rendu 3D

Deux systèmes indépendants : le moteur procédural (`src/features/viewer-3d/`) construit la maison à partir du plan et suit chacune de ses modifications ; les modèles détaillés (`src/features/detailed-houses/`) sont des fichiers GLB figés, affichés tels quels.

- Ciel et lumière : photographies HDR réelles (CC0 Poly Haven, `public/hdri/`) : un parc tondu en plein jour, un golf au crépuscule pour le mode Soir. La moitié basse de l'image est projetée au sol autour du terrain (`GroundedSkybox`) : l'horizon est un vrai paysage, et la pelouse du terrain s'y fond par un dégradé. Le soleil directionnel est aligné sur le soleil de la photo (direction mesurée sur l'image), ombres douces PCSS. Jour par défaut.
- Post-traitement en qualité Élevée : occlusion ambiante débruitée (N8AO), tone mapping AgX, lueur limitée aux lampes, anticrénelage SMAA, vignettage. En visite, une lumière de rebond éclaire les plafonds.
- Matériaux PBR photographiques (couleur, normales, rugosité ; CC0 Poly Haven, `public/textures/`), à l'échelle physique (UV en mètres) et recolorés vers la couleur du matériau. Une variation à grande échelle dans le shader masque la répétition des textures (mélange de deux échelles pour l'herbe, le béton, le gravier et l'enduit ; variation de teinte pour les tuiles, lames et pierres). Verre : reflets de Fresnel du ciel sur un vitrage transparent, sans passe de transmission coûteuse ; vue de l'extérieur, une fenêtre reflète davantage le ciel (24 %) pour rester lisible comme en vrai, de l'intérieur elle reste claire (4 %) ; les garde-corps vitrés gardent 4 % des deux côtés. Le ciel visible et les reflets du soleil sont plafonnés sous le seuil de la lueur, l'éclairage restant calculé sur l'image HDR complète. En plein jour, les plafonds reçoivent un léger rebond chaud. Façades : enduit, parement pierre, bardage bois, béton banché.
- Toitures (`architecture/roof-assembly.tsx`, `roof-geometry.ts`) : pans épais posés sur l'arête extérieure des murs, débords, sous-faces, pignons maçonnés dans le matériau de façade, rives, bandeaux, faîtage et arêtiers (tuiles rondes ou faîtière métal), gouttières demi-rondes et descentes d'eau, cheminée à boisseaux, panneaux solaires ; toit plat avec acrotère et couvertine, ou dalle débordante.
- Menuiseries (`architecture/openings.tsx`) : dormant posé près du nu intérieur (tableau extérieur profond habillé du matériau de façade), ouvrants à la française, vitrages, appui extérieur et tablette intérieure ; portes d'entrée (aluminium moderne ou bois peint à panneaux), portes intérieures à chambranles, baies coulissantes, porte de garage sectionnelle, seuils. Option « Volets et encadrements » : volets battants à barres et écharpe, encadrements enduits.
- Aménagement (`landscape/garden.tsx`) : pelouse, allées pavées et allée gravillonnée avec bordures béton, terrasses bordurées, haies taillées et arbres (feuillus, bouleaux, conifères) en cartes de feuilles instanciées (un appel de dessin par essence, normales de volume, ombrage interne), troncs en écorce photographique, arbustes et massifs scannés.
- Mobilier scanné (GLB CC0, `public/models/`) ajusté aux cotes du plan ; autres meubles en primitives proportionnées.
- Escaliers entre étages (`src/domain/plan/stairs.ts`, `walk.ts`), quatre modèles choisis dans le panneau Propriétés (« Modèle ») : droit, quart tournant à gauche, quart tournant à droite (volées de 0,9 m et palier d'angle) et demi-tournant (deux volées et un palier sur toute la largeur, jour central). Chaque modèle est un parcours de volées et de paliers à hauteurs de marche égales ; il sert à la 3D (marches en chêne, mains courantes qui suivent la pente sur les côtés dégagés), à la trémie découpée et bordée d'un garde-corps, au symbole 2D (marches, palier, ligne de foulée) et à la visite, où l'on monte, tourne sur le palier et redescend en marchant. Le panneau indique l'arrivée, le nombre et la hauteur des marches, ou la raison d'un blocage.
- Performance : rendu à la demande en vue extérieure, niveaux de qualité Automatique / Économique / Élevée, pièces d'une ouverture fusionnées par matériau, feuillage instancié, lumières limitées au niveau visité. Mesure en Chrome sans interface, rotation automatique 1440 × 900 : environ 28 images/s, contre 27 avant la refonte.

## Modèles

- Plans modifiables : `src/domain/plan/templates/`, un générateur commun (`buildPlanFromSpec`) et cinq spécifications déclaratives (style, pièces, portes, fenêtres, meubles, matériaux, toiture, volets). `scripts/template-projects.ts create|delete` crée ou retire un projet par modèle pour les inspecter.
- Modèles détaillés : `src/features/detailed-houses/catalog.ts` (fichier, échelle vérifiée, maillages masqués, niveaux, emprise et hauteur mesurées, auteur, source, licence). Fichiers GLB optimisés (textures WebP, géométrie meshopt) dans `public/models/houses/`.

## Limitations connues

- Pièces rectangulaires uniquement (la colonne `polygon` et le type `Room.polygon` préparent les polygones).
- Escaliers : quatre modèles à volées droites et paliers ; pas d'escalier hélicoïdal ni de marches balancées. La trémie suit le rectangle englobant de chaque volée et palier : une rotation qui n'est pas un multiple de 90° découpe une trémie plus large. Les modèles de maisons utilisent l'escalier droit ; les autres modèles se choisissent dans l'éditeur.
- Les meubles ne bloquent pas le visiteur.
- Modèles détaillés : non modifiables, sans plan, donc sans surface habitable ni nombre de pièces ; pas de visite intérieure (il faudrait des collisions sur maillage). Aucune maison complète CC0 n'existe sur Poly Haven ; les trois retenues viennent de Sketchfab via le jeu de données Objaverse, sous licence CC BY 4.0.
- Arbres et haies procéduraux (cartes de feuilles, houppiers bosselés, haies ondulées) : crédibles à distance d'orbite, moins détaillés de très près qu'un arbre scanné.
- Villa Aalsmeer : exportée « non éclairée » (KHR_materials_unlit) et sans normales ; ses matériaux sont convertis à l'affichage en PBR éclairé avec un ombrage plat par facette (géométrie inchangée, adaptation mentionnée dans l'attribution). Ses textures contiennent un éclairage précalculé : le rendu reste un peu clair et peu contrasté.
- Toiture calculée sur le rectangle englobant de l'étage supérieur ; l'acrotère remplace le débord quand le débord d'un toit plat est inférieur à 20 cm.
- Pas d'authentification : tous les projets sont visibles par tous.
- La 3D n'est pas testée automatiquement (WebGL) ; les tests couvrent la géométrie, le schéma, le projet de démonstration et la marche dans les escaliers (montée, descente, garde-corps).
