# Forge3D

**Forge3D** crée des fichiers **STL imprimables en 3D**, sur ordinateur comme sur téléphone,
directement dans le navigateur : https://forge3d.web.app

- **Modèles** réglables prêts à imprimer : trophée, plaque gravée, porte-clés, boîte à couvercle,
  support de téléphone, image en relief.
- **Éditeur** : pièces, aperçu 3D sur le plateau de l'imprimante, propriétés, vérifications avant
  impression, pauses de couleur et export STL.
- **Atelier** : modélisation libre (formes solides ou trous, croquis 2D, extrusion, révolution).
- **Créer avec l'IA** : décrivez l'objet en français, Claude propose un modèle modifiable.
- **Mes projets** : sauvegarde avec un compte Google, autosauvegarde sur l'appareil, fichiers
  `.forge3d.json`.
- Application installable (PWA) qui fonctionne hors ligne (sauf le mode IA).

Toutes les mesures sont en millimètres. L'interface est en français.

---

## Mise en ligne sans rien installer

Tout se fait depuis **GitHub** et la **console Firebase**, sans Node ni Git sur votre poste.
Comptez 20 à 30 minutes la première fois.

### 1. Créer le projet Firebase

1. Ouvrez https://console.firebase.google.com puis **Ajouter un projet**.
   Notez l'**ID du projet** (sous le nom, par exemple `forge3d-a1b2c`).
2. **Forfait** : le forfait gratuit **Spark** suffit pour toute l'application, sauf le mode
   « Créer avec l'IA » (il affiche alors « Mode IA non configuré »). Le forfait **Blaze**
   (paiement à l'usage, quotas gratuits inclus) n'est nécessaire que pour l'IA : voir
   [Activer le mode IA plus tard](#activer-le-mode-ia-plus-tard).
3. Toujours dans **Paramètres du projet › Général**, section **Vos applications**, cliquez sur
   l'icône **Web `</>`** et enregistrez une application nommée `Forge3D`
   (inutile de cocher Firebase Hosting ici ; ignorez le code affiché).

### 2. Activer la connexion Google et Firestore

1. **Créer › Authentication › Commencer** puis, dans l'onglet **Mode de connexion**, activez
   **Google**.
2. Dans **Authentication › Paramètres › Domaines autorisés**, ajoutez `forge3d.web.app`.
3. **Créer › Firestore Database › Créer une base de données** : mode **production**,
   emplacement **`eur3 (europe)`** ou `europe-west1`. Les règles sont déployées par la CI.

### 3. Créer le site Hosting `forge3d`

1. **Créer › Hosting › Commencer** : passez les étapes d'installation (la CI s'en charge).
   Si l'ID du projet est exactement `forge3d`, le site `forge3d` existe déjà : passez à l'étape 4.
2. En bas de la page Hosting, **Ajouter un autre site**, puis saisissez l'identifiant `forge3d`.
   L'adresse sera **https://forge3d.web.app**.
   Si `forge3d` est déjà pris, choisissez un autre identifiant et remplacez `"site": "forge3d"`
   dans `firebase.json` (modifiable directement sur GitHub).

### 4. Créer le compte de service pour GitHub

1. Ouvrez https://console.cloud.google.com/iam-admin/serviceaccounts en sélectionnant votre projet.
2. **Créer un compte de service** : nom `github-deploy`.
3. Donnez-lui ces rôles :
   - Administrateur Firebase Hosting (`roles/firebasehosting.admin`)
   - Administrateur des règles Firebase (`roles/firebaserules.admin`)
   - Administrateur d'index Cloud Datastore (`roles/datastore.indexAdmin`)
   - Utilisateur du compte de service (`roles/iam.serviceAccountUser`)
   - Administrateur Service Usage (`roles/serviceusage.serviceUsageAdmin`)
   - Lecteur Firebase (`roles/firebase.viewer`)
4. Ouvrez le compte créé › **Clés › Ajouter une clé › Créer une clé › JSON**.
   Un fichier `.json` est téléchargé : il servira à l'étape suivante, puis supprimez-le de
   votre ordinateur.

### 5. Ajouter les secrets GitHub

Dans le dépôt GitHub : **Settings › Secrets and variables › Actions › New repository secret**.

| Nom | Valeur |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | tout le contenu du fichier JSON de l'étape 4 |
| `FIREBASE_PROJECT_ID` | l'ID du projet Firebase (étape 1) |
| `ANTHROPIC_API_KEY` | **facultatif**, seulement avec le forfait Blaze : votre clé API Anthropic |

Sans `ANTHROPIC_API_KEY`, la CI ne déploie que le site et les règles Firestore (compatible
Spark) ; l'application fonctionne normalement et affiche « Mode IA non configuré ».

### 6. Premier déploiement

Le déploiement live se fait à chaque mise à jour de la branche **`main`**.

- Si la branche `main` n'existe pas encore : sur GitHub, ouvrez la liste des branches
  (**Code › Branches**), cliquez sur **New branch**, nommez-la `main` à partir de la branche de
  travail, puis définissez-la comme branche par défaut (**Settings › General › Default branch**).
- Ensuite, chaque **pull request** vers `main` est vérifiée (lint, tests, build) et publiée sur un
  canal de prévisualisation ; le lien apparaît en commentaire de la PR.
- Fusionner la PR dans `main` met le site en ligne sur https://forge3d.web.app
  (suivi dans l'onglet **Actions**).
- Pour relancer un déploiement : **Actions › CI et déploiement › Run workflow**.

### 7. Vérifier

- https://forge3d.web.app s'ouvre sur la galerie des modèles ; sur téléphone, le menu du
  navigateur propose « Installer l'application » (Android) ou « Sur l'écran d'accueil » (iOS).
- Connectez-vous dans **Mes projets** (bouton Google) et enregistrez un projet.
- En cas de souci, l'onglet **Actions** du dépôt indique l'étape en échec.

### Activer le mode IA plus tard

1. Passez au forfait **Blaze** : **⚙ Paramètres du projet › Utilisation et facturation ›
   Détails et forfaits**. Conseil : créez une alerte de budget (par exemple 5 €) dans
   Google Cloud Billing. Les appels à Claude sont facturés à part par Anthropic.
2. Ajoutez ces rôles au compte de service `github-deploy` (étape 4) :
   - Administrateur Cloud Functions (`roles/cloudfunctions.admin`)
   - Administrateur Cloud Run (`roles/run.admin`)
   - Administrateur Artifact Registry (`roles/artifactregistry.admin`)
   - Éditeur Cloud Build (`roles/cloudbuild.builds.editor`)
   - Administrateur Secret Manager (`roles/secretmanager.admin`)
3. Ajoutez le secret GitHub `ANTHROPIC_API_KEY` (clé créée sur https://console.anthropic.com).
4. Relancez le déploiement : **Actions › CI et déploiement › Run workflow** sur `main`.

---

## Réglages utiles (sans installation)

| Besoin | Où le changer (directement sur GitHub) |
|---|---|
| Modèle de Claude utilisé par l'IA | créer `functions/.env` avec `CLAUDE_MODEL=claude-sonnet-5-5` (valeur par défaut) |
| Nombre de créations IA par jour | `functions/.env` : `DAILY_LIMIT=30` |
| Identifiant du site Hosting | `firebase.json` → `"site": "forge3d"` |
| Léopard officiel du trophée | remplacer `LEOPARD_SVG` dans `src/templates/leopard.ts` par le contenu de `normandie-leopard.svg` |

La clé Anthropic ne se met jamais dans ces fichiers : uniquement dans le secret GitHub
`ANTHROPIC_API_KEY` (la CI la copie dans Secret Manager).

## Ce qui est vérifié automatiquement

À chaque pull request et à chaque mise à jour de `main`, la CI exécute :

- **ESLint** et **TypeScript** (mode strict) ;
- **Vitest** (75 tests) : moteur géométrique, export STL relu comme un slicer, textes des
  4 polices, croquis (vase Ø 64 × 100, paroi 2,5), les 6 modèles (STL valides sur la 5M Pro,
  trophée 250 mm avec pauses 7,8 / 8,2 / 58,2 mm), temps de calcul (< 300 ms par modèle
  courant), fichiers de projet ; et les tests de la Cloud Function (client simulé) ;
- **Playwright** : parcours principaux sur ordinateur (1440 px) et téléphone (390 px) et audit
  d'accessibilité **axe** (WCAG 2 A/AA, aucune violation grave tolérée).

---

## Développement (facultatif, avec Node 24)

```bash
npm ci
```

```bash
npm run dev
```

```bash
npm test
```

```bash
npm run build
```

```bash
npm run e2e
```

Voir `CLAUDE.md` pour l'architecture et les conventions, `DECISIONS.md` pour les choix techniques
et `CHANGELOG.md` pour l'historique des versions.

## Licences

Code : tous droits réservés. Polices embarquées : SIL Open Font License (Cinzel, Inter,
Bebas Neue) et Apache 2.0 (Roboto Slab), voir `public/fonts/licenses/`.
