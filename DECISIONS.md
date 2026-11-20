# Journal des décisions techniques

Format : date — décision — raison. Les écarts au brief ou aux maquettes sont signalés **[écart]**.

## 2026-11-20 — J0

- **Maquettes récupérées depuis l'artefact « Forge3D — maquette »** : le dépôt était vide (pas de
  `docs/brief/`). Les 8 écrans (`.dc.html`) et leurs 4 rendus 3D sont copiés dans
  `docs/brief/maquettes/`.
- **[écart] Référence Python du trophée et SVG du léopard absents** : ni `reference-trophee/` ni
  `normandie-leopard.svg` n'ont été fournis. Le trophée sera reconstruit à partir du brief (cotes,
  pauses 7,8 / 8,2 / 58,2 mm) et du rendu `docs/brief/maquettes/images/trophee.png`. Le léopard
  sera remplacé par le fichier fourni dès qu'il sera ajouté au dépôt.
- **Node 24 en CI, Functions en Node 22** **[écart]** : le brief demande Node 20, mais Node 20 est
  en fin de vie (avril 2026) et n'est plus accepté par Cloud Functions ; `firebase-admin` 14 exige
  Node ≥ 22 et le SDK web `firebase` 13 annonce Node ≥ 24. Runtime des Functions : `nodejs22`.
- **TypeScript 6.0** (et non 7) : `typescript-eslint` ne prend pas encore en charge TypeScript 7.
- **zod 4 + `z.toJSONSchema`** à la place de `zod-to-json-schema` **[écart]** : zod 4 génère
  nativement le JSON Schema ; `zod-to-json-schema` ne gère pas les schémas zod 4.
- **Configuration web Firebase lue depuis `/__/firebase/init.json`** (URL réservée de Hosting) :
  aucune clé dans le dépôt ni dans la CI ; l'utilisateur n'a rien à copier.
- **Polices UI auto-hébergées** via `@fontsource-variable` (Inter, Space Grotesk) : aucun appel à
  Google Fonts (brief §11).
- **Polices 3D** : TTF statiques générées par `scripts/build_fonts.py` (instanciation des polices
  variables au bon poids + sous-ensemble latin, 23–43 Ko chacune). Roboto Slab est sous licence
  Apache 2.0 (et non OFL) ; licence libre compatible, jointe dans `public/fonts/licenses/`.
- **Routage** : `react-router` (mode déclaratif), une URL par espace (`/modeles`, `/editeur`,
  `/atelier`, `/ia`, `/projets`), réécriture SPA dans `firebase.json`.
- **Téléphone < 900 px** : barre de navigation à 4 onglets en bas ; au-dessus, en-tête de 60 px.
- **Ajouts optionnels au schéma de Scène** : `transform.scale` (miroir et redimensionnement des
  groupes), `Part.colors` (couleurs des tranches de l'aperçu bicolore), `text.lineSpacing`,
  `segments` sur `sphere`/`cone`/`tube`. Tous facultatifs, compatibles avec le brief §3.
- **Origine des objets** : centre de la base (z = 0 en bas de l'objet), rotation en degrés (ordre
  X, Y, Z) autour de cette origine. Plus simple pour l'IA (« posé sur z = 0 »).
- **Arcs de croquis** encodés par `bulge` (convention DXF) : compact, sans ambiguïté, direct à
  l'import DXF.
- **Dépôt initialement vide** : la première branche poussée (`claude/…`) devient la branche par
  défaut ; la CI ne déploie en live que depuis `main` (voir README pour créer `main`).

## 2026-11-20 — J1

- **Orientation d'impression** : `flatOnBack` = rotation de −90° autour de X (le dos, côté +Y,
  repose sur le plateau), puis centrage XY et pose sur z = 0. Les pauses et la coloration de
  l'aperçu sont calculées dans cette orientation (matrice `printMatrix` transmise au shader).
- **Pauses alignées sur les couches** : pour un rendu propre, un changement de couleur Zc doit
  être un sommet de couche (ex. dessus du plateau à 7,6 mm → pause à 7,8 mm).
- **Rotation** : X puis Y puis Z autour des axes fixes (convention manifold `rotate`), soit
  l'ordre d'Euler « ZYX » de three.js. Vérifié par un test.
- **Surplombs** : faces inclinées à plus de 45° vers le bas, en ignorant celles qui ont moins de
  2,5 mm de vide en dessous (bas des lettres en relief, petits porte-à-faux) ; alerte au-delà de
  60 mm². Lancer de rayons manifold (`rayCast`), échantillonné (≤ 4 000 rayons).
- **Détails fins** : ouverture morphologique (érosion puis dilatation de 0,2 mm) de tranches
  horizontales tous les 0,8 mm ; alerte si plus de 2 mm² disparaissent.
- **Vue « Plateau »** : disposition des pièces côte à côte dans leur orientation d'impression ;
  « 3/4 » et « Face » montrent l'assemblage.
- **Gestes tactiles** : 1 doigt = déplacer la vue, 2 doigts = pincer pour zoomer et tourner
  (brief §2 et maquette « 2 doigts pour tourner »).
- **Export de plusieurs pièces** : un STL par pièce ; téléchargements successifs sur ordinateur,
  archive .zip sur téléphone (les navigateurs mobiles bloquent les téléchargements multiples).
- **Images** réduites à 512 px (PNG, fond blanc) avant d'entrer dans la scène, pour limiter la
  taille des projets (Firestore : 1 Mio par document).
- **Champ `template`** (facultatif) ajouté à la Scène : identifiant et réglages du modèle
  paramétrique d'origine, pour rouvrir ses réglages.

## 2026-11-20 — J2

- **Atelier = mêmes données que l'éditeur** : une seule scène ouverte (store partagé) ; passer de
  l'atelier à l'éditeur conserve le travail.
- **Affichage par objet** dans l'atelier (comme Tinkercad) : chaque forme est évaluée seule par le
  worker, recalculée uniquement si sa forme change (un déplacement ne coûte rien). L'option
  « Voir le résultat » affiche la fusion booléenne.
- **Gizmo** : la transformation n'est enregistrée qu'au relâchement (une seule étape d'annulation
  par geste) ; l'échelle est convertie en paramètres (dimensions, rayons) quand c'est possible,
  sinon conservée dans `transform.scale` (texte, croquis, groupes).
- **Groupes** : origine au centre XY et au bas de la sélection ; le gizmo agit sur les objets de
  premier niveau (les enfants se règlent par les champs numériques).
- **Dégrouper un groupe « trou »** : ses solides deviennent des trous ; ses trous internes, qui
  n'ont plus de sens, sont retirés (message affiché).
- **Miroir** : matrice de symétrie autour du centre de la sélection, décomposée en
  `transform.scale` négatif (manifold gère l'inversion des faces).
- **Aligner un objet seul** : référence = plateau (centrer en X/Y, poser en Z).
- **[écart] En-tête de l'atelier** : sélecteur d'imprimante en version courte (« 5M Pro ») à côté
  de la bascule Formes / Croquis 2D ; la maquette ne le montre pas, mais le brief le veut dans
  l'en-tête.
- **Test d'acceptation** : la reconstruction du support de téléphone de la maquette (socle,
  dossier incliné à −22°, rebord, passe-câble en trou) demande 58 saisies / clics, soit environ
  1 min 30 pour un humain ; résultat vérifié étanche, 1 bloc, sans support.
