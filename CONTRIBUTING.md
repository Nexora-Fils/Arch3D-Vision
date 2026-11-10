# Contribuer à HomePlan 3D

Ce guide s'adresse aux développeurs qui rejoignent le projet. Le [README](README.md) décrit le produit, les écrans et le rendu 3D ; ce document décrit comment travailler dans le dépôt.

## Installation

Prérequis :

- Node.js 20.9 ou plus récent (minimum requis par Next.js 16) ;
- pnpm 10 (`corepack enable` active la version fixée dans `package.json`) ;
- Docker Desktop, pour PostgreSQL.

```bash
pnpm install                 # pnpm uniquement : jamais npm ni yarn
cp .env.example .env         # changez POSTGRES_PASSWORD et reportez-le dans DATABASE_URL
pnpm db:up                   # PostgreSQL 17 dans Docker, port hôte 5433 par défaut
pnpm db:migrate              # applique les migrations
pnpm db:generate             # génère le client Prisma dans src/generated/ (non versionné)
pnpm db:seed                 # crée le projet de démonstration « Maison familiale moderne »
pnpm dev                     # http://localhost:3000
```

Bon à savoir :

- Le port hôte de PostgreSQL est `POSTGRES_PORT`. S'il est déjà pris, changez-le dans `.env` **et** dans `DATABASE_URL`.
- Sans client Prisma généré, `pnpm typecheck` et `pnpm build` échouent. Relancez `pnpm db:generate` après chaque changement de `prisma/schema.prisma`, y compris après un `git pull`.
- Après une migration, redémarrez `pnpm dev` : le serveur garde l'ancien client Prisma en mémoire et peut renvoyer des erreurs du type « X is not a function ».
- `next dev` réécrit le bloc `nextjs-agent-rules` de `AGENTS.md`. S'il apparaît dans `git status`, committez-le tel quel : l'annuler ne fait que le recréer.
- `pnpm db:down` arrête PostgreSQL et conserve les données. `docker compose down -v` les efface.

## Organisation du code

| Zone | Dossier | Rôle |
|---|---|---|
| Domaine | `src/domain/plan/` | Modèle métier pur, sans React, Three.js ni Prisma : schémas Zod, géométrie, escaliers, déplacement du visiteur, modèles de maisons |
| État | `src/store/` | Zustand : `plan-store` (plan, annuler, rétablir), `editor-store` (outil, sélection, zoom), `viewer-store` (qualité, jour ou soir, caméra) |
| Éditeur 2D | `src/features/editor-2d/` | React Konva : `editor-canvas.tsx`, formes dans `canvas/`, barre d'outils, panneau Propriétés, raccourcis |
| Moteur 3D | `src/features/viewer-3d/` | React Three Fiber : maison générée depuis le plan (`house-model.tsx`), toitures et menuiseries (`architecture/`), jardin (`landscape/`), matériaux, éclairage, post-traitement |
| Visite | `src/features/walkthrough/` | Vue à la première personne : contrôleur, clavier et joystick tactile, minicarte. Collisions et escaliers calculés par `src/domain/plan/walk.ts` |
| Modèles détaillés | `src/features/detailed-houses/` | Maquettes GLB figées décrites dans `catalog.ts`, système indépendant du plan |
| Persistance | `prisma/`, `src/lib/projects/`, `src/app/api/projects/` | Schéma et migrations, dépôt (`repository.ts`), Server Actions, API REST validée par Zod |
| Authentification | `src/lib/auth/`, `src/app/api/auth/`, `src/proxy.ts` | Comptes, sessions en base, règle d'accès aux projets (`access.ts`), redirection des pages privées |
| Routes | `src/app/` | `(marketing)` pages publiques, `(app)` tableau de bord et galerie, `(workspace)` écrans plein écran d'un projet. L'accueil est `src/app/page.tsx` |
| Écrans | `src/features/<écran>/` | Composants propres à un écran (`dashboard`, `landing`, `templates`, `settings`, `materials`). `project/` fournit le projet courant aux écrans du workspace |
| Composants partagés | `src/components/` | Composants transverses ; primitives shadcn/ui dans `ui/` |

Règles d'architecture :

- **Le plan est la seule source de vérité.** Coordonnées en mètres, angles en degrés. L'éditeur 2D applique l'échelle sur le `Stage` Konva ; la 3D convertit uniquement dans `src/features/viewer-3d/convert.ts`. Le plan ne contient jamais de pixels ni de coordonnées de scène.
- **Les types viennent des schémas Zod** (`src/domain/plan/schema.ts`, via `z.infer`). Un nouveau champ s'ajoute d'abord au schéma ; s'il a sa propre colonne, aussi à `prisma/schema.prisma` (avec une migration) et à `repository.ts`.
- **La logique va dans le domaine.** Un calcul (surface, collision, volée d'escalier) s'écrit en fonction pure, testable sans navigateur ; les composants l'affichent.
- Konva et WebGL ne tournent pas côté serveur : chargez leurs canevas avec `dynamic(..., { ssr: false })`, comme dans `plan-editor.tsx`.
- Prisma est réservé au serveur : passez par `src/lib/projects/repository.ts` (ou `src/lib/auth/` pour les comptes).
- **Tout accès à un projet est autorisé côté serveur** : `authorizeProject` dans les routes d'API et les Server Actions, `projectAccessVerdict` dans les pages. Le proxy ne vérifie que la présence du cookie.
- Les deux systèmes 3D restent indépendants : un modèle détaillé n'a pas de plan et ne passe pas par le moteur procédural.

## Conventions de code

- **TypeScript strict** : ni `any` ni `enum`. Une liste de valeurs s'écrit en tableau `as const` avec son type dérivé (`z.enum` de Zod reste autorisé) :

  ```ts
  export const EDITOR_TOOLS = ["select", "pan", "room"] as const;
  export type EditorTool = (typeof EDITOR_TOOLS)[number];
  ```

- `interface` pour les props et les objets, `type` pour les unions et les types dérivés.
- `export const` partout ; `export default` seulement là où Next.js l'exige (`page.tsx`, `layout.tsx`, `not-found.tsx`, `error.tsx`).
- **Nommage** : fichiers et dossiers en kebab-case (`roof-assembly.tsx`), composants et types en PascalCase, fonctions en camelCase, hooks en `use*`, booléens en prédicats (`isOpen`, `hasRoof`), handlers `handleX` en interne et `onX` en prop.
- **Langue** : textes d'interface en français ; code, commentaires, identifiants et noms de branches en anglais.
- **Style** : Tailwind et les composants de `src/components/ui/` (ajout : `pnpm exec shadcn add <composant>`). L'attribut `style` est réservé aux valeurs calculées à l'exécution (position, couleur d'un matériau).
- **Assets** : aucune ressource distante à l'exécution. Toute image, texture, HDR, vidéo ou modèle est servi depuis le dépôt, et sa licence est inscrite dans `src/assets/images/LICENSES.md`. Optimisez un GLB avant de l'ajouter :

  ```bash
  pnpm dlx @gltf-transform/cli@4 optimize input.glb output.glb --compress meshopt --texture-compress webp
  ```

- **Dépendances** : justifiez toute nouvelle dépendance dans la PR ; préférez une bibliothèque stable et répandue.
- **Secrets** : uniquement dans `.env` (ignoré par git). Toute nouvelle variable est documentée dans `.env.example`.

## Branches, commits et pull requests

### Branches

Une branche par sujet, créée depuis `main` à jour, nommée `<type>/<sujet-court>` en kebab-case et en anglais : `feature/architectural-rendering`, `bugfix/stairs-upper-floor`, `chore/linear-mcp`.

### Commits

Format Conventional Commits, sans scope (le dépôt n'a qu'un paquet) : `<type>: <sujet>`.

- **Types** : `feature`, `bugfix`, `fix`, `hotfix`, `chore`, `release`. Toujours `feature`, jamais `feat`. La documentation, les captures régénérées et l'outillage passent en `chore`.
- **Sujet** : en français, en minuscules, 72 caractères au plus, sans point final, verbe au présent comme la suite de « ce commit… ».
- **Un commit = un changement logique.** Un diff qui mêle deux sujets se découpe en deux commits.

```text
feature: ajoute les escaliers quart tournant et demi-tournant
bugfix: rend le verre transparent de face et réfléchissant de biais
chore: documente les modèles d'escalier et la surface habitable
```

### Pull requests

- Cible : `main`. Les PR sont fusionnées par squash : leur titre devient le commit sur `main`, donnez-lui le même format qu'un commit.
- Remplissez le modèle (`.github/pull_request_template.md`) : ticket Linear `HOM-…`, description, vérifications.
- **Capture d'écran obligatoire pour toute modification d'interface.**

## Avant d'ouvrir une PR

À lancer à chaque fois :

```bash
pnpm lint
pnpm typecheck
pnpm test        # Vitest : src/**/*.test.ts
pnpm build
```

La CI (`.github/workflows/ci.yml`) relance ces quatre commandes sur chaque PR vers `main`, puis `pnpm test:e2e` contre une base PostgreSQL neuve, migrée et seedée.

Selon le changement :

| Changement | Vérification supplémentaire |
|---|---|
| API, persistance ou pages | `pnpm test:e2e` avec le serveur lancé et la démo seedée. Le script crée deux comptes de test (`e2e-owner@homeplan.test`, `e2e-other@homeplan.test`) et un projet qu'il supprime à la fin ; la démo n'est jamais modifiée. Autre port : `pnpm test:e2e http://localhost:3001`. Démo seedée avec un ancien identifiant : `DEMO_ID=demo-project-maison-familiale-moderne pnpm test:e2e` |
| Schéma Prisma | Migration nommée (`pnpm db:migrate --name <short-name>`), dossier `prisma/migrations/` committé avec le schéma |
| Logique de domaine | Tests Vitest dans le `__tests__/` du module, cas limites compris |
| 3D, visite ou éditeur 2D | Vérification à la main dans le navigateur (la 3D n'est pas testée automatiquement) : Jour et Soir, extérieur et visite, fluidité |
| Interface | Captures dans la PR, textes en français, affichage vérifié sur mobile |
| Fonctionnalité ou limite visible | `README.md` à jour (Écrans, Rendu 3D, Limitations connues) |
