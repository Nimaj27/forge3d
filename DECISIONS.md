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
