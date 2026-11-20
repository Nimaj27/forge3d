# Journal des modifications

Toutes les évolutions notables de Forge3D sont consignées ici.

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le projet respecte le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

## [1.0.0] — 2026-11-20

Première version complète de Forge3D (jalons J0 à J7).

### Ajouté

- Tests de bout en bout Playwright : galerie → porte-clés → STL, trophée (pauses 7,8 / 8,2 /
  58,2 mm), atelier (cube + trou), croquis (révolution → scène), IA non configurée, export de
  projet ; sur ordinateur (1440 px) et téléphone (390 px), exécutés en CI.
- Audit d'accessibilité axe (WCAG 2 A/AA) sur les 6 écrans : aucune violation grave.
- Test de performance : chaque modèle courant se calcule en moins de 300 ms (plaque 63 ms,
  porte-clés 25 ms, image 71 ms ; trophée complet ≈ 360 ms).
- README final : mise en ligne sans installation, réglages, vérifications automatiques ;
  démarrage possible avec le forfait gratuit Spark (sans IA), puis activation de l'IA en Blaze.

### Modifié

- Chargement à la demande des écrans : le premier affichage ne charge plus que 282 Ko de
  JavaScript (au lieu de 1,5 Mo) ; le moteur 3D arrive avec l'éditeur.

### Corrigé

- Bandes de boutons défilantes du téléphone accessibles au clavier.
- Workflow CI refusé par GitHub, aucune exécution ne démarrait : `hashFiles` interdit dans la
  condition d'un job (tests de bout en bout) et nom d'étape contenant « : » non entre guillemets.

## [0.7.0] — 2026-11-20

### Ajouté

- « Mes projets » : connexion Google, projets enregistrés en ligne (Firestore,
  `users/{uid}/projects`, miniature de l'aperçu), ouverture, mise à jour, suppression.
- Autosauvegarde du travail sur l'appareil (IndexedDB), restaurée au démarrage et enregistrée
  à chaque modification (et au passage en arrière-plan sur téléphone).
- Import et export de fichiers `.forge3d.json` (validés à l'import, message clair sinon).
- Application installable (PWA) : manifeste, icônes, service worker qui met en cache
  l'application, le moteur WASM, le worker et les polices : tout fonctionne hors ligne, sauf
  le mode IA et la sauvegarde en ligne.

### Modifié

- Règles Firestore : la scène d'un projet est enregistrée en JSON (texte ≤ 900 Ko).

## [0.6.0] — 2026-11-20

### Ajouté

- Mode IA « Créer avec l'IA » : description en français, photo ou croquis joint, conversation
  itérative (« texte plus grand », « ajoute 2026 »), aperçu 3D avec vérifications et pauses,
  « Ajuster dans l'éditeur », export STL ; version téléphone.
- Cloud Function `generateScene` (2ᵉ génération, europe-west1, Node 22) : clé Anthropic dans
  Secret Manager uniquement, connexion Google obligatoire, quota de 30 générations par jour et
  par utilisateur (Firestore `usage/{uid}/days/{aaaammjj}`, écrit côté serveur, rendu en cas
  d'échec), outil `build_scene` dont le schéma est généré depuis le schéma zod de la Scène,
  validation zod, bornage au plateau, une nouvelle tentative avec l'erreur renvoyée à Claude.
- Modèle configurable (`CLAUDE_MODEL`, `claude-sonnet-5-5` par défaut) avec repli automatique
  côté serveur si le modèle refuse une demande.
- Connexion Google (Firebase Auth) ; « Mode IA non configuré » affiché sans bloquer le reste.
- CI : build et tests des Functions ; déploiement des Functions quand la clé est fournie.

## [0.5.0] — 2026-11-20

### Ajouté

- Les 6 modèles paramétriques, ouverts dans l'éditeur avec un formulaire de réglages par
  sections (la section de l'élément sélectionné est mise en avant), modifications annulables,
  « Détacher du modèle » pour une édition libre :
  - **Trophée** (2 pièces, 250 mm par défaut) : socle en coque loft d'octogones (plinthe, corps
    incliné, corniche à 43° sans support), inscription 3 lignes et filet décoratif sur la face
    avant inclinée, mortaise 46,5 × 6,5 × 20,5 ; bouclier imprimé à plat (7,6 + 2,2 mm), écu
    avec bordure à rivets et 2 léopards, banderole courbe « DÉFIS SPORTIFS » et pans en queue
    d'aronde, tenon 46 × 20 × 6. Pauses : bouclier 7,8 mm, socle 8,2 et 58,2 mm.
  - **Plaque gravée** : texte 1 à 3 lignes, logo, cadre, 2 ou 4 trous avec fraisage, bicolore.
  - **Porte-clés** : rond, rectangle arrondi ou écusson, texte, étoile ou cœur, anneau, bordure.
  - **Boîte à couvercle** : couvercle emboîtant ou coulissant, jeu réglable (2 pièces).
  - **Support de téléphone** : largeur, angle, épaisseur de l'appareil, passe-câble.
  - **Image en relief** : logo (seuil), photo en relief ou lithophane, plaque de fond.
- Nouveau type d'objet « coque » (loft) : sections octogonales reliées en une seule surface.
- Images en relief calculées dans le worker (logo par seuil puis extrusion ; carte de hauteur).
- Vérification propre au trophée : « Tenon / mortaise : jeu 0,25 mm ».
- Liste des éléments : les groupes de plus de 6 éléments sont repliés.

### Corrigé

- L'aperçu disparaissait quand la liste des éléments était longue (l'espace de travail suit
  désormais la hauteur de l'écran, chaque panneau défile seul).
- Les faces situées exactement sur un changement de couleur prenaient la couleur du dessus.
- Triangles dégénérés après conversion en float32 : contours simplifiés à 1 µm et maillage
  d'export nettoyé.
- Détection des détails fins trop sensible aux pointes des lettres.

## [0.4.0] — 2026-11-20

### Ajouté

- Texte 3D (opentype.js) avec les 4 polices embarquées (Cinzel Black, Inter Bold, Bebas Neue,
  Roboto Slab Bold) : plusieurs lignes, alignement, crénage, espacement des lettres, hauteur des
  capitales mesurée sur le « H », épaississement de 0,06 mm, séparation des pincements.
- Texte sur un arc (déformation polaire, arc bombé ou creusé).
- Dessins SVG en relief (analyse SVG autonome, utilisable dans le worker : chemins, arcs,
  rectangles arrondis, cercles, ellipses, polygones, groupes et transformations).
- Atelier « Croquis 2D » : ligne, courbe (Bézier lissée), arc, cercle, rectangle arrondi,
  polygone ; poignées pour déplacer les points et courber les segments ; aimantation grille
  1 mm, points et axe ; zoom molette et pincer.
- Cotes en mm exacts : longueur et angle du segment suivant, coordonnées des points, diamètre,
  largeur × hauteur, rayon et côtés ; affichage des cotes (hauteur, largeur ou Ø en révolution).
- Symétrie (un demi-profil appuyé sur l'axe devient une forme symétrique unique), « Creuser
  (paroi) » : silhouette → paroi de vase d'épaisseur constante (fond + ouverture), ou anneau.
- Import SVG / DXF (lignes, arcs, polylignes avec arrondis, cercles, ellipses, splines ;
  contours chaînés automatiquement ; unités du DXF respectées).
- Transformation en 3D : extrusion (hauteur) ou révolution (angle, lissage), aperçu 3D,
  « Ajouter à la scène », « Exporter seul en STL », modification d'un croquis existant.

### Corrigé

- Polices : les contours qui se chevauchaient (polices variables) sont fusionnés ; sans cela,
  le remplissage EvenOdd perçait la plupart des lettres.

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
