## Le croquis 2D

<!-- ecran: /atelier/croquis -->

Le croquis sert à dessiner un profil coté au millimètre, puis à le transformer en volume : une
plaque découpée, un vase, un bouchon, un pion…

### Dessiner

- Outils de dessin : <!-- auto:outils-croquis -->.
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
