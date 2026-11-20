# Journal des modifications

Toutes les évolutions notables de Forge3D sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet respecte le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

## [0.3.0] — 2026-11-20

### Ajouté

- Atelier « Formes » : cube, cylindre, sphère, cône, tube et texte ; chaque forme est Solide ou
  Trou (trous translucides, « retirés à l'export »).
- Gizmo (déplacer, tourner, redimensionner) avec aimantation à la grille de 1 mm et à 15° ;
  le redimensionnement est converti en vraies dimensions (mm) pour les formes simples.
- Champs numériques (virgule ou point, flèches ±1, Maj ±10), curseur « Inclinaison ».
- Grouper / dégrouper, dupliquer, aligner (sur la sélection ou sur le plateau), poser sur le
  plateau, miroir X / Y / Z, nouvelle scène annulable.
- Sélection au clic ou au toucher (Maj + clic pour plusieurs), badge « nom · dimensions · angle ».
- « Voir le résultat » : aperçu de la pièce fusionnée (solides − trous).
- Raccourcis : Ctrl+Z / Ctrl+Maj+Z, Ctrl+D, Ctrl+G / Ctrl+Maj+G, Suppr, flèches.
- Version téléphone de l'atelier (bande de formes, outils, propriétés, barre de navigation).
- Barrière d'erreur : un écran qui plante n'emporte plus toute l'application.

### Corrigé

- Le panneau de vérifications plantait sur une scène vide.
- En-tête trop large à 1440 px dans l'atelier (sélecteur d'imprimante en version courte).

## [0.2.0] — 2026-11-20

### Ajouté

- Moteur géométrique manifold-3d (WASM) dans un Web Worker (Comlink) : le thread principal ne
  calcule jamais de géométrie ; cache LRU par empreinte, recalcul avec anti-rebond.
- Primitives : cube (arêtes arrondies), cylindre, sphère, cône, tube, croquis extrudé ou en
  révolution, groupes ; fusion des solides puis soustraction des trous.
- Éditeur : liste des pièces et éléments, aperçu 3D (Z vers le haut, plateau et volume
  d'impression, grille 10 mm), vues 3/4, Face et Plateau (orientation d'impression), propriétés
  de l'élément sélectionné, surbrillance de la sélection, annuler / rétablir (Ctrl+Z).
- Vérifications avant impression, recalculées en continu : tient sur le plateau (avec
  propositions « pivoter » ou « coucher »), maillage étanche en un seul bloc, détails < 0,4 mm,
  surplombs > 45°, pose sur le plateau.
- Export STL binaire, vérifié comme un slicer (fusion des sommets en float32, 0 arête
  non-manifold, 0 triangle dégénéré, 1 bloc) ; avertissement sinon. Archive projet (.zip) avec
  STL, `.forge3d.json` et notes de pauses.
- Aperçu bicolore par pauses : « Pause à X mm » au plus petit sommet de couche au-dessus du
  changement, couleurs modifiables (gris #9A9DA2 / or #D6A838 par défaut).
- Version téléphone de l'éditeur : aperçu en haut, tiroir à onglets (Éléments, Propriétés,
  Impression), barre Annuler / Exporter fixée en bas.

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
