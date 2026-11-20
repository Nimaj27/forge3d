# Journal des modifications

Toutes les évolutions notables de Forge3D sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet respecte le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

## [0.1.0] — 2026-11-20

### Ajouté

- Squelette de l'application : Vite, React 19, TypeScript strict, ESLint, Vitest.
- Thème sombre « forge » (variables CSS, accent modifiable), polices Inter et Space Grotesk
  auto-hébergées, icônes SVG au trait.
- En-tête ordinateur (logo cube, navigation Modèles · Éditeur · Atelier · Créer avec l'IA ·
  Mes projets, sélecteur d'imprimante mémorisé) et barre de navigation mobile à 4 onglets.
- Profils d'imprimante : Flashforge Adventurer 5M Pro (par défaut), Bambu Lab A1, A1 mini,
  Prusa MK4, imprimante personnalisée.
- Galerie des 6 modèles avec recherche (les modèles eux-mêmes arrivent au jalon J4).
- Schéma zod de la Scène partagé (`shared/scene.ts`) et formatage des nombres en français.
- Polices 3D embarquées en TTF : Cinzel Black, Inter Bold, Bebas Neue, Roboto Slab Bold.
- Configuration Firebase : Hosting (site `forge3d`, réécriture SPA, cache, type MIME wasm),
  règles Firestore (projets privés par utilisateur, quota IA interdit côté client).
- CI GitHub Actions : lint, tests, build, prévisualisation sur PR, déploiement live sur `main`.
- Documentation : README (déploiement sans installation locale), CLAUDE.md, DECISIONS.md.
- Maquettes validées archivées dans `docs/brief/maquettes/`.
