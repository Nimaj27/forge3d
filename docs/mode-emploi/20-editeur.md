## L’éditeur

<!-- ecran: /editeur -->

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
