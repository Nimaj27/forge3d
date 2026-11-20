/** Connexion Google (Firebase Auth) : état réactif et actions. */
import type { User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { getFirebaseApp } from './app';

export interface AuthState {
  /** `undefined` pendant le chargement, `null` si déconnecté */
  user: User | null | undefined;
  /** Firebase est-il configuré (sinon : mode hors ligne) */
  available: boolean;
}

async function auth() {
  const app = await getFirebaseApp();
  if (!app) return null;
  const { getAuth } = await import('firebase/auth');
  return getAuth(app);
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: undefined, available: true });
  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void auth().then(async (a) => {
      if (cancelled) return;
      if (!a) {
        setState({ user: null, available: false });
        return;
      }
      const { onAuthStateChanged } = await import('firebase/auth');
      unsub = onAuthStateChanged(a, (user) => setState({ user, available: true }));
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);
  return state;
}

export async function signInWithGoogle(): Promise<void> {
  const a = await auth();
  if (!a) throw new Error('Connexion indisponible : Firebase n’est pas configuré.');
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(a, provider);
  } catch (err) {
    // fenêtres surgissantes bloquées (fréquent sur téléphone) : redirection
    if ((err as { code?: string }).code === 'auth/popup-blocked') await signInWithRedirect(a, provider);
    else throw err;
  }
}

export async function signOutUser(): Promise<void> {
  const a = await auth();
  if (!a) return;
  const { signOut } = await import('firebase/auth');
  await signOut(a);
}
