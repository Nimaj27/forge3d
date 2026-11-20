<!-- Fichier généré : ne pas le modifier à la main. Le texte se rédige dans docs/mode-emploi/, les listes viennent du code. Régénérer avec « npm run guide ». -->

# Forge3D — Mode d’emploi

**Version 1.1.0** · mis à jour le 20 novembre 2026 · https://forge3d.web.app

Forge3D crée des fichiers **STL** prêts à imprimer en 3D, directement dans le navigateur, sur
ordinateur comme sur téléphone. Toutes les mesures sont en **millimètres**.

> Ce mode d’emploi suit l’application : les listes (modèles et réglages, imprimantes, formes,
> outils, raccourcis, nouveautés) sont tirées directement du code à chaque nouvelle version.

## Sommaire

- [Démarrer](#démarrer)
- [Partir d’un modèle](#partir-dun-modèle)
- [L’éditeur](#léditeur)
- [L’atelier : modéliser avec des formes](#latelier--modéliser-avec-des-formes)
- [Le croquis 2D](#le-croquis-2d)
- [Créer avec l’IA](#créer-avec-lia)
- [Mes projets](#mes-projets)
- [Imprimer](#imprimer)
- [Raccourcis clavier](#raccourcis-clavier)
- [Installer l’application et travailler hors ligne](#installer-lapplication-et-travailler-hors-ligne)
- [Nouveautés](#nouveautés)
- [Annexe : réglages de chaque modèle](#annexe--réglages-de-chaque-modèle)

## Démarrer

1. Ouvrez https://forge3d.web.app (ou l’application installée, voir
   [Installer l’application](#installer-lapplication-et-travailler-hors-ligne)).
2. Choisissez votre **imprimante** dans l’en-tête : Forge3D vérifie que chaque pièce tient sur son
   plateau.
3. Partez d’un **modèle** prêt à régler, modélisez librement dans l’**atelier**, ou décrivez votre
   objet à l’**IA**.
4. Contrôlez les **vérifications avant impression**, puis **exportez le STL** et ouvrez-le dans le
   logiciel de découpe de votre imprimante.

Aucun compte n’est nécessaire pour créer et exporter. Un compte Google sert seulement à enregistrer
vos projets en ligne et à utiliser l’IA.

### Les écrans

| Écran | Adresse directe |
|---|---|
| [Modèles](#partir-dun-modèle) | forge3d.web.app/modeles |
| [Éditeur](#léditeur) | forge3d.web.app/editeur |
| [Atelier](#latelier--modéliser-avec-des-formes) | forge3d.web.app/atelier |
| [Créer avec l’IA](#créer-avec-lia) | forge3d.web.app/ia |
| [Mes projets](#mes-projets) | forge3d.web.app/projets |

Sur téléphone, la barre du bas donne accès à **Modèles**, **Atelier**, **IA** et **Projets** ;
l’éditeur s’ouvre quand vous choisissez un modèle.

### Imprimantes

| Imprimante | Volume d’impression (X × Y × Z) |
|---|---|
| Flashforge Adventurer 5M Pro (par défaut) | 220 × 220 × 220 mm |
| Bambu Lab A1 | 256 × 256 × 256 mm |
| Bambu Lab A1 mini | 180 × 180 × 180 mm |
| Prusa MK4 | 250 × 210 × 220 mm |
| Personnalisée | volume que vous saisissez |

Le choix est mémorisé sur l’appareil. **Personnalisée** permet de saisir le volume d’impression de
n’importe quelle autre imprimante.

## Partir d’un modèle

L’écran **Modèles** présente des objets tout prêts, entièrement réglables. Tapez quelques lettres
dans **Rechercher un modèle** pour filtrer la liste, puis touchez une carte : le modèle s’ouvre dans
l’[éditeur](#léditeur).

| Modèle | Pour faire | Sections de réglages |
|---|---|---|
| [Trophée](#trophée) | Socle gravé + bouclier, blason, banderole | Socle : inscription · Bouclier : banderole et blason · Dimensions |
| [Plaque gravée](#plaque-gravée) | Texte, logo, trous de fixation | Plaque · Texte · Logo |
| [Porte-clés](#porte-clés) | Prénom, forme, anneau | Forme · Texte et motif · Anneau |
| [Boîte à couvercle](#boîte-à-couvercle) | Dimensions intérieures, jeu | Boîte · Couvercle |
| [Support téléphone](#support-téléphone) | Angle, largeur, passe-câble | Support · Passe-câble |
| [Image en relief](#image-en-relief) | Logo ou photo en 3D | Image · Plaque de fond |

Chaque réglage (valeur par défaut, valeurs possibles) est détaillé en annexe :
[réglages de chaque modèle](#annexe--réglages-de-chaque-modèle).

Les textes en relief utilisent l’une des polices embarquées :

- Cinzel Black (classique)
- Inter Bold (moderne)
- Bebas Neue (sport)
- Roboto Slab Bold (robuste)

## L’éditeur

L’éditeur s’ouvre quand vous choisissez un modèle (ou avec **Ajuster dans l’éditeur** depuis l’IA).
Il réunit trois zones :

- **Pièces du projet** : les pièces imprimées séparément et leurs éléments. Touchez un élément pour
  le sélectionner.
- **Aperçu 3D** : l’objet posé sur le plateau de votre imprimante. Faites glisser pour tourner
  autour, utilisez la molette ou pincez pour zoomer.
- **Réglages et propriétés** : les réglages du modèle, ou les propriétés de l’élément sélectionné.

Sur téléphone, l’aperçu occupe le haut de l’écran et les panneaux **Éléments**, **Propriétés** et
**Impression** s’affichent en dessous.

### Régler le modèle

Les réglages sont rangés par sections (par exemple *Forme*, *Texte*, *Anneau*) ; chaque changement
s’applique aussitôt à l’aperçu. **Détacher du modèle (édition libre)** transforme le modèle en
objets ordinaires, modifiables un par un ; ses réglages ne sont alors plus proposés.

Les boutons **Annuler** et **Rétablir** de l’en-tête (ou `Ctrl + Z` / `Ctrl + Maj + Z`) reviennent
sur chaque modification.

### Vérifications avant impression

Forge3D contrôle chaque pièce comme le ferait un logiciel de découpe :

- **Plateau** : la pièce tient-elle sur le plateau de l’imprimante choisie ?
- **Maillage** : étanche et d’un seul bloc ?
- **Pose** : la pièce repose-t-elle à plat sur le plateau ?
- **Surplombs** : faudra-t-il des supports ?
- **Détails fins** : y a-t-il des parties plus fines que 0,4 mm (la largeur d’une buse standard) ?

Le résultat s’affiche en vert (**Prêt à imprimer**), orange (**À vérifier**) ou rouge
(**À corriger**). Certaines lignes proposent une correction en un clic : **Coucher la pièce**,
**Pivoter de 90°** ou **Poser sur le plateau**. Les modèles ajoutent leurs propres contrôles, comme
le jeu entre le tenon et la mortaise du trophée.

### Orientation d’impression

Dans les propriétés d’une pièce, **Orientation d’impression** vaut **Telle quelle** ou **Couchée sur
le dos** : la pièce est alors basculée pour être imprimée à plat, face avant vers le haut. Le STL
est exporté directement dans cette position.

### Couleurs et pauses

La barre **Couleurs par couche**, sous l’aperçu, permet d’imprimer une pièce en plusieurs couleurs
avec un seul extrudeur :

1. Touchez une pastille pour choisir la couleur de chaque tranche (l’aperçu se colore).
2. **Ajouter une pause** : saisissez la hauteur (en mm) où changer de filament. Forge3D la cale sur
   le sommet de la couche suivante et affiche **Pause à … mm**.
3. Dans votre logiciel de découpe, ajoutez une pause (ou un changement de filament) à chacune de ces
   hauteurs. Le fichier `LISEZMOI.txt` du projet téléchargé les rappelle.

### Exporter

- **Exporter le STL** (ou *Exporter bouclier.stl + socle.stl* quand il y a plusieurs pièces) : un
  fichier STL par pièce, en millimètres, au maillage vérifié. Sur téléphone, les fichiers sont réunis
  dans une archive `.zip`.
- **Télécharger le projet (.zip)** : les STL, le projet modifiable (`.forge3d.json`) et un fichier
  `LISEZMOI.txt` avec les notes d’impression (hauteur de couche, pauses de couleur).

## L’atelier : modéliser avec des formes

L’atelier sert à modéliser librement en assemblant des formes simples, comme un jeu de
construction. Le sélecteur **Formes / Croquis** en haut de l’écran bascule vers le
[croquis 2D](#le-croquis-2d).

### Ajouter et placer des formes

- Formes disponibles : **Cube**, **Cylindre**, **Sphère**, **Cône**, **Tube** et **Texte**.
- Chaque forme est **Solide** (ajoutée) ou **Trou** (retirée des solides à l’export) : de quoi
  percer, évider ou graver.
- Touchez une forme pour la sélectionner, puis utilisez les outils **Déplacer**, **Tourner** et **Redimensionner**
  avec les poignées de la vue 3D.
- **Aimanter à la grille · 1 mm** : les déplacements se font au millimètre près et les rotations
  par pas de 15°.
- Les dimensions et positions exactes se saisissent dans les **propriétés de la forme**.
- Sur téléphone : pincez pour zoomer, faites glisser avec deux doigts pour tourner la vue.

### Organiser

- **Dupliquer** et **Supprimer** la sélection.
- **Grouper** plusieurs formes pour les déplacer ensemble ; **Dégrouper** pour les séparer.
- **Aligner** la sélection (gauche, centre, droite, avant, arrière, haut, bas…).
- **Miroir** : retourne la sélection (gauche ↔ droite, avant ↔ arrière, haut ↔ bas).
- **Poser sur le plateau** et **Centrer sur le plateau**.
- **Voir le résultat** : affiche l’objet final, trous retirés, tel qu’il sera exporté.
- **Nouvelle scène** : repart d’une scène vide.

### Exporter

**Exporter le STL** fusionne les formes (solides moins trous), vérifie le maillage et télécharge le
fichier. Les vérifications avant impression sont les mêmes que dans l’[éditeur](#léditeur).

## Le croquis 2D

Le croquis sert à dessiner un profil coté au millimètre, puis à le transformer en volume : une
plaque découpée, un vase, un bouchon, un pion…

### Dessiner

- Outils de dessin : **Ligne**, **Courbe**, **Arc**, **Cercle**, **Rectangle** et **Polygone**.
- Cliquez (ou touchez) pour placer les points. Le panneau **Précision** permet de saisir les
  valeurs exactes : coordonnées X et Y, longueur et angle de chaque segment, puis **Placer le
  point** ou **Valider**.
- **Sélectionner / modifier** : déplacez un point, **insérez un point après**, supprimez un point
  ou une forme.
- **Cotes** affiche les dimensions sur le dessin ; **Grille 1 mm** aimante le tracé.
- **Symétrie** complète le dessin par symétrie autour de l’axe.
- **Paroi** transforme le contour en paroi d’épaisseur choisie (pour un objet creux).
- **Importer SVG / DXF** reprend un dessin existant (logo, découpe…).

### Transformer en 3D

Dans le panneau **Transformer en 3D** :

- **Extruder** donne de l’épaisseur au dessin (**Hauteur d’extrusion**).
- **Révolution** fait tourner le profil autour de l’axe vertical ; le **Lissage** règle la finesse
  du résultat.
- L’aperçu 3D se met à jour à chaque changement. **Ajouter à la scène** envoie le volume dans
  l’atelier ; **Exporter seul en STL** le télécharge directement. Pour un croquis déjà placé dans la
  scène, le bouton devient **Mettre à jour dans la scène**.

Exemple : un vase de Ø 64 × 100 mm se dessine en traçant la moitié de son profil, puis en appliquant
une **Paroi** de 2,5 mm et une **Révolution**.

## Créer avec l’IA

Décrivez votre objet en français (« une plaque de porte avec mon nom », « une boîte avec
couvercle »…) : l’IA propose un modèle 3D modifiable, que vous pouvez affiner en conversation
(« plus épais », « ajoute deux trous de fixation »).

- La connexion avec un compte Google est nécessaire.
- Joignez une **photo ou un croquis** pour guider la forme.
- Les **suggestions** sous la zone de saisie donnent des idées de départ.
- **Ajuster dans l’éditeur** ouvre le résultat dans l’[éditeur](#léditeur) ; **Exporter le STL** le
  télécharge directement.
- Chaque personne dispose de 30 créations par jour.

> Si l’écran affiche « Mode IA non configuré », l’IA n’est pas encore activée sur ce site (voir le
> [README](README.md#activer-le-mode-ia-plus-tard)). Le reste de l’application fonctionne
> normalement.

## Mes projets

- **Sauvegarde automatique** : le projet en cours est enregistré en continu sur votre appareil,
  même hors ligne, et rouvert à votre retour.
- **Se connecter avec Google** pour enregistrer vos projets en ligne et les retrouver sur tous vos
  appareils : **Enregistrer en ligne**, puis **Ouvrir** depuis la liste **Enregistrés en ligne**.
  Chaque personne ne voit que ses propres projets.
- **Exporter .forge3d.json** enregistre le projet dans un fichier, à garder ou à partager ;
  **Importer un fichier** le rouvre, sur n’importe quel appareil et sans compte.

## Imprimer

1. Ouvrez le fichier STL dans le logiciel de découpe de votre imprimante (Orca-Flashforge, Bambu
   Studio, PrusaSlicer…). Les fichiers sont en millimètres : aucune mise à l’échelle n’est
   nécessaire.
2. Les pièces sont exportées dans leur orientation d’impression, posées à plat : placez-les telles
   quelles sur le plateau.
3. Utilisez la hauteur de couche du projet (0,2 mm par défaut) pour que les pauses de couleur
   tombent juste.
4. Si le projet comporte des **pauses**, ajoutez une pause (ou un changement de filament) à chaque
   hauteur indiquée **Pause à … mm**.

## Raccourcis clavier

Les raccourcis ne s’appliquent pas pendant la saisie dans un champ de texte. Sur Mac, `Cmd`
remplace `Ctrl`.

| Touches | Action | Disponible dans |
|---|---|---|
| `Ctrl + Z` | Annuler la dernière modification | Éditeur et atelier |
| `Ctrl + Maj + Z` ou `Ctrl + Y` | Rétablir | Éditeur et atelier |
| `Ctrl + D` | Dupliquer la sélection | Atelier |
| `Ctrl + G` | Grouper la sélection | Atelier |
| `Ctrl + Maj + G` | Dégrouper | Atelier |
| `Suppr` ou `Retour arrière` | Supprimer la sélection (sauf les éléments verrouillés) | Éditeur et atelier |
| `Échap` | Tout désélectionner | Éditeur et atelier |
| `Flèches` | Déplacer la sélection de 1 mm (Maj : 10 mm ; Alt + ↑ / ↓ : en hauteur) | Atelier |

## Installer l’application et travailler hors ligne

- **Android** (Chrome) : menu ⋮ › **Installer l’application**.
- **iPhone / iPad** (Safari) : bouton Partager › **Sur l’écran d’accueil**.
- **Ordinateur** (Chrome, Edge) : icône d’installation dans la barre d’adresse.

Après une première visite, l’application fonctionne **sans connexion internet**, sauf l’IA et
l’enregistrement en ligne. Les mises à jour s’installent automatiquement.

## Nouveautés

### Version 1.1.0 (20 novembre 2026)

**Ajouté**

- **Mode d’emploi** (`MODE_EMPLOI.md`) : prise en main, chaque écran, couleurs et pauses, impression,
  raccourcis clavier, installation hors ligne et réglages détaillés de chaque modèle. Il se met à
  jour avec l’application : les listes (modèles, réglages, imprimantes, formes, outils, raccourcis)
  sont tirées du code et les nouveautés de ce journal.

**Modifié**

- Les raccourcis clavier sont décrits dans une liste unique, utilisée par le clavier et par le mode
  d’emploi.

### Version 1.0.0 (20 novembre 2026)

Première version complète de Forge3D (jalons J0 à J7).

**Ajouté**

- Tests de bout en bout Playwright : galerie → porte-clés → STL, trophée (pauses 7,8 / 8,2 /
  58,2 mm), atelier (cube + trou), croquis (révolution → scène), IA non configurée, export de
  projet ; sur ordinateur (1440 px) et téléphone (390 px), exécutés en CI.
- Audit d'accessibilité axe (WCAG 2 A/AA) sur les 6 écrans : aucune violation grave.
- Test de performance : chaque modèle courant se calcule en moins de 300 ms (plaque 63 ms,
  porte-clés 25 ms, image 71 ms ; trophée complet ≈ 360 ms).
- README final : mise en ligne sans installation, réglages, vérifications automatiques ;
  démarrage possible avec le forfait gratuit Spark (sans IA), puis activation de l'IA en Blaze.

**Modifié**

- Chargement à la demande des écrans : le premier affichage ne charge plus que 282 Ko de
  JavaScript (au lieu de 1,5 Mo) ; le moteur 3D arrive avec l'éditeur.

**Corrigé**

- Bandes de boutons défilantes du téléphone accessibles au clavier.
- Workflow CI refusé par GitHub, aucune exécution ne démarrait : `hashFiles` interdit dans la
  condition d'un job (tests de bout en bout) et nom d'étape contenant « : » non entre guillemets.

### Version 0.7.0 (20 novembre 2026)

**Ajouté**

- « Mes projets » : connexion Google, projets enregistrés en ligne (Firestore,
  `users/{uid}/projects`, miniature de l'aperçu), ouverture, mise à jour, suppression.
- Autosauvegarde du travail sur l'appareil (IndexedDB), restaurée au démarrage et enregistrée
  à chaque modification (et au passage en arrière-plan sur téléphone).
- Import et export de fichiers `.forge3d.json` (validés à l'import, message clair sinon).
- Application installable (PWA) : manifeste, icônes, service worker qui met en cache
  l'application, le moteur WASM, le worker et les polices : tout fonctionne hors ligne, sauf
  le mode IA et la sauvegarde en ligne.

**Modifié**

- Règles Firestore : la scène d'un projet est enregistrée en JSON (texte ≤ 900 Ko).

L’historique complet des versions est dans [CHANGELOG.md](CHANGELOG.md).

## Annexe : réglages de chaque modèle

### Trophée

Socle gravé + bouclier, blason, banderole.

**Socle : inscription**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Ligne 1 | « PRÉSIDENT DU DÉPARTEMENT » | texte libre |
| Ligne 2 | « DE L’EURE » | texte libre |
| Nom (ligne 3) | « ALEXANDRE RASSAËRT » | texte libre |
| Police | Cinzel Black (classique) | 4 polices |
| Hauteur des lettres du nom | 6,6 mm | 3 mm à 10 mm |
| Relief des textes | 1 mm | 0,6 mm à 2 mm |

**Bouclier : banderole et blason**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Texte de la banderole (vide : aucune) | « DÉFIS SPORTIFS » | texte libre |
| Blason | Normandie (2 léopards) | Normandie (2 léopards) / Aucun / Image importée |
| Image du blason | aucune | image à importer |

**Dimensions**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Hauteur totale | 250 mm | 150 mm à 250 mm |

### Plaque gravée

Texte, logo, trous de fixation.

**Plaque**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Largeur | 150 mm | 30 mm à 250 mm |
| Hauteur | 60 mm | 15 mm à 250 mm |
| Épaisseur | 4 mm | 1,6 mm à 12 mm |
| Coins arrondis | 6 mm | 0 mm à 30 mm |
| Cadre en relief | Oui | Oui / Non |
| Largeur du cadre | 2 mm | 0,8 mm à 8 mm |
| Trous de fixation | 2 trous | Aucun / 2 trous / 4 trous (coins) |
| Ø des trous | 4,5 mm | 2 mm à 12 mm |
| Fraisage (vis à tête fraisée) | Oui | Oui / Non |

**Texte**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Texte (1 à 3 lignes) | « Caserne de Pacy » | texte libre |
| Police | Cinzel Black (classique) | 4 polices |
| Hauteur des lettres | 10 mm | 3 mm à 40 mm |
| Relief | 1,2 mm | 0,4 mm à 4 mm |
| Bicolore (pause au-dessus de la plaque) | Oui | Oui / Non |

**Logo**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Logo (image) | aucune | image à importer |
| Largeur du logo | 22 mm | 5 mm à 100 mm |

### Porte-clés

Prénom, forme, anneau.

**Forme**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Forme | Rond | Rond / Rectangle arrondi / Écusson |
| Taille | 40 mm | 20 mm à 90 mm |
| Épaisseur | 3 mm | 1,6 mm à 8 mm |
| Bordure en relief | Oui | Oui / Non |
| Largeur de la bordure | 1,5 mm | 0,8 mm à 4 mm |

**Texte et motif**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Texte | « PACY » | texte libre |
| Police | Cinzel Black (classique) | 4 polices |
| Hauteur des lettres | 8,5 mm | 3 mm à 25 mm |
| Relief | 1,5 mm | 0,4 mm à 4 mm |
| Motif | Étoile | Aucun / Étoile / Cœur |
| Bicolore (pause au-dessus du disque) | Oui | Oui / Non |

**Anneau**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Ø de l’anneau | 13 mm | 8 mm à 25 mm |
| Ø du trou | 5,2 mm | 3 mm à 12 mm |

### Boîte à couvercle

Dimensions intérieures, jeu.

**Boîte**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Longueur intérieure | 80 mm | 10 mm à 200 mm |
| Largeur intérieure | 60 mm | 10 mm à 200 mm |
| Hauteur intérieure | 40 mm | 5 mm à 200 mm |
| Épaisseur de paroi | 2 mm | 1,2 mm à 6 mm |
| Épaisseur du fond | 2 mm | 1 mm à 6 mm |
| Coins arrondis | 3 mm | 0 mm à 20 mm |

**Couvercle**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Couvercle | Emboîtant | Emboîtant / Coulissant |
| Jeu du couvercle — *0,2 mm convient à la plupart des imprimantes.* | 0,2 mm | 0 mm à 1 mm |

### Support téléphone

Angle, largeur, passe-câble.

**Support**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Largeur | 80 mm | 40 mm à 200 mm |
| Angle du dossier — *Mesuré depuis la table (90° = vertical).* | 68° | 50° à 85° |
| Épaisseur du téléphone (avec coque) | 12 mm | 6 mm à 30 mm |
| Profondeur du socle | 70 mm | 50 mm à 150 mm |
| Hauteur du dossier | 78 mm | 40 mm à 160 mm |

**Passe-câble**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Passe-câble dans le rebord | Oui | Oui / Non |
| Largeur du passage | 14 mm | 6 mm à 25 mm |

### Image en relief

Logo ou photo en 3D.

**Image**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Image (logo ou photo) | image d’exemple | image à importer |
| Style | Logo (contours nets) | Logo (contours nets) / Photo en relief / Lithophane (à voir en transparence) |
| Largeur | 80 mm | 10 mm à 250 mm |
| Seuil (clair / foncé) | 128 | 1 à 254 |
| Inverser clair / foncé | Non | Oui / Non |
| Relief | 2 mm | 0,4 mm à 6 mm |
| Épaisseur min. | 0,8 mm | 0,4 mm à 5 mm |
| Épaisseur max. | 3 mm | 0,8 mm à 10 mm |

**Plaque de fond**

| Réglage | Par défaut | Valeurs possibles |
|---|---|---|
| Plaque de fond | Oui | Oui / Non |
| Épaisseur de la plaque | 2 mm | 0,8 mm à 8 mm |
| Marge autour de l’image | 4 mm | 0 mm à 20 mm |
| Coins arrondis | 3 mm | 0 mm à 20 mm |
