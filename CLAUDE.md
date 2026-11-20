# CLAUDE.md — conventions du dépôt Forge3D

Forge3D est une PWA (Vite + React + TypeScript strict) qui crée des fichiers STL imprimables.
Hébergement : https://forge3d.web.app (Firebase Hosting, site `forge3d`).
Brief complet et maquettes validées : `docs/brief/` (référence visuelle : `docs/brief/maquettes/`).

## Langues

- Interface, commentaires, documentation, messages de commit : **français**.
- Identifiants de code (variables, fonctions, types, fichiers) : **anglais**.
- Nombres affichés via `src/lib/format.ts` (`Intl.NumberFormat('fr-FR')`, ex. « 7,8 mm »). Toutes les mesures sont en **mm**.
- Espaces insécables : utiliser la constante `NBSP` de `format.ts` dans les gabarits (la config ESLint est protégée).

## Commandes

| Commande | Rôle |
|---|---|
| `npm ci` | installer les dépendances |
| `npm run dev` | serveur de développement Vite |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b` |
| `npm test` | Vitest (géométrie, modèles, formats) |
| `npm run build` | typecheck + build de production dans `dist/` |
| `npm run e2e` | Playwright (smoke tests, nécessite `npm run build`) |
| `npm run guide` | régénère `MODE_EMPLOI.md` (texte de `docs/mode-emploi/` + listes tirées du code) |
| `npm run icons` | régénère les icônes PWA depuis le logo |
| `python3 -I scripts/build_fonts.py` | régénère les TTF de `public/fonts` (fonttools) |
| `npm --prefix functions run build` | build de la Cloud Function d'IA (esbuild) |
| `npm --prefix functions test` | tests de la Cloud Function (client Anthropic simulé) |

## Architecture

```
shared/scene.ts        Schéma zod de la Scène (source de vérité unique, partagé app + functions)
src/geometry/          Moteur géométrique manifold-3d (exécuté dans un Web Worker via Comlink)
src/viewer/            Aperçu 3D react-three-fiber (repère Z vers le haut, plateau, grille)
src/store/             États Zustand (scène + annuler/rétablir, réglages persistés)
src/templates/         Modèles paramétriques : (params) => Scene
src/pages/             Écrans : Modèles, Éditeur, Atelier, IA, Projets
src/components/        Composants d'interface (en-tête, navigation, icônes SVG…)
src/firebase/          Initialisation Firebase (config lue depuis /__/firebase/init.json), auth Google
src/sketch/            Croquis 2D (modèle éditable, canevas SVG, import SVG/DXF)
src/atelier/           Atelier Formes (affichage par objet, gizmo, grouper/aligner/miroir)
src/ai/                Conversation avec l'IA (appel de la Cloud Function)
src/projects/          Projets : IndexedDB, Firestore, fichiers .forge3d.json
functions/             Cloud Function `generateScene` (IA, europe-west1, Node 22)
e2e/                   Tests Playwright (parcours + accessibilité axe)
src/guide/             Générateur du mode d'emploi (MODE_EMPLOI.md) et son test
docs/mode-emploi/      Texte rédigé du mode d'emploi, une section par fichier
public/fonts/          Polices TTF embarquées pour le texte 3D (OFL / Apache 2.0)
```

Règles clés :

- **Tout passe par la Scène** (`shared/scene.ts`). L'IA ne renvoie que du JSON de Scène, jamais de code.
- **Le thread principal ne calcule jamais de géométrie** : tout passe par le worker (`src/geometry/worker.ts`).
- Repère : X largeur, Y profondeur, **Z hauteur** ; l'origine d'un objet est le centre de sa base.
- Leçons du trophée (brief §4) : pas d'union de faces coplanaires (encastrer les reliefs de 0,5 mm),
  `offset(-0.015)` contre les pincements, `offset(-0.3)` puis `offset(+0.3)` après soustraction,
  texte épaissi de +0,06 mm.
- Thème : variables CSS dans `src/styles/tokens.css` ; cibles tactiles ≥ 44 px ; icônes SVG au trait.
- Chaque jalon : tests au vert, entrée dans `CHANGELOG.md`, décisions dans `DECISIONS.md`.
- **Mode d'emploi** : à chaque ajout visible par l'utilisateur, compléter la section concernée de
  `docs/mode-emploi/` (nouvel écran : nouveau fichier avec `<!-- ecran: /route -->`), puis
  `npm run guide`. Les listes (modèles, réglages, imprimantes, polices, formes, outils, raccourcis,
  nouveautés) se mettent à jour seules depuis le code et le CHANGELOG ; un test échoue si
  `MODE_EMPLOI.md` n'est pas régénéré. Ne jamais modifier `MODE_EMPLOI.md` à la main.

## Secrets

Aucun secret dans le dépôt. La clé Anthropic vit dans Secret Manager (synchronisée par la CI) et
n'est lue que par la Cloud Function. La configuration web Firebase est servie par Hosting.
