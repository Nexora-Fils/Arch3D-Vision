## Ticket

HOM-

## Changement

<!-- Ce que fait la PR et pourquoi, en quelques lignes. Signalez toute nouvelle dépendance ou variable d'environnement. -->

## Captures

<!-- Obligatoire pour toute modification d'interface. Ajoutez la version mobile si la mise en page change. -->

## Vérifications

Détail dans `CONTRIBUTING.md`, section « Avant d'ouvrir une PR ».

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` et `pnpm build` passent
- [ ] `pnpm test:e2e` passe (si l'API, la persistance ou les pages changent)
- [ ] Tests ajoutés pour la logique nouvelle et ses cas limites
- [ ] Migration Prisma committée avec le schéma (si le schéma change)
- [ ] 3D, visite ou éditeur 2D vérifiés à la main dans le navigateur (si modifiés)
- [ ] Textes d'interface en français, affichage vérifié sur mobile
- [ ] Commits et titre de la PR au format `<type>: <sujet>`
- [ ] Licence des nouveaux assets inscrite dans `src/assets/images/LICENSES.md`
- [ ] `.env.example` et `README.md` à jour si nécessaire
