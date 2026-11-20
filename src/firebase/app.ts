import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';

/**
 * Initialisation paresseuse de Firebase.
 *
 * En production, la configuration vient de l'URL réservée de Firebase Hosting
 * `/__/firebase/init.json` : aucune clé n'est versionnée dans le dépôt.
 * En développement local, on peut fournir `VITE_FIREBASE_CONFIG` (JSON).
 * Sans configuration, l'appli fonctionne hors connexion (pas de comptes ni d'IA).
 */
let appPromise: Promise<FirebaseApp | null> | null = null;

async function loadConfig(): Promise<FirebaseOptions | null> {
  const fromEnv = import.meta.env.VITE_FIREBASE_CONFIG;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv) as FirebaseOptions;
    } catch {
      console.warn('VITE_FIREBASE_CONFIG invalide');
    }
  }
  try {
    const res = await fetch('/__/firebase/init.json', { cache: 'no-cache' });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('json')) return null;
    const cfg = (await res.json()) as FirebaseOptions;
    return cfg.apiKey && cfg.projectId ? cfg : null;
  } catch {
    return null;
  }
}

/** Renvoie l'application Firebase, ou `null` si elle n'est pas configurée / hors ligne. */
export function getFirebaseApp(): Promise<FirebaseApp | null> {
  if (!appPromise) {
    appPromise = loadConfig().then((cfg) => (cfg ? initializeApp(cfg) : null));
    // En cas d'échec réseau, on autorise une nouvelle tentative plus tard.
    appPromise.then((app) => {
      if (!app) appPromise = null;
    });
  }
  return appPromise;
}

/** Région des Cloud Functions (brief §2). */
export const FUNCTIONS_REGION = import.meta.env.VITE_FUNCTIONS_REGION ?? 'europe-west1';
