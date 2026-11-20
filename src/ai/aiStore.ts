/**
 * Conversation avec l'IA (Cloud Function `generateScene`) : messages, versions de scène, état.
 */
import { create } from 'zustand';
import type { Scene } from '../../shared/scene';
import { FUNCTIONS_REGION, getFirebaseApp } from '../firebase/app';

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Miniature de l'image jointe (data URL) */
  image?: string;
  scene?: Scene;
  version?: number;
  error?: boolean;
}

/**
 * Accès à l'IA pour le compte connecté : « allowed » (adresse autorisée), « reserved » (IA réservée au
 * propriétaire du site), « off » (IA non configurée), « unknown » (pas encore vérifié ou hors ligne).
 */
export type AiAccess = 'unknown' | 'allowed' | 'reserved' | 'off';

interface AiState {
  access: AiAccess;
  /** Compte pour lequel l'accès a été vérifié */
  accessFor: string | null;
  /** Vérifie (sans appeler Claude ni consommer de quota) si ce compte peut utiliser l'IA */
  checkAccess: (uid: string) => Promise<void>;
  messages: AiMessage[];
  pending: boolean;
  /** Dernière scène générée */
  scene: Scene | null;
  version: number;
  send: (input: { prompt: string; image?: { data: string; mediaType: 'image/jpeg'; preview: string } | null; currentScene?: Scene | null; printer: { id: string; bed: [number, number, number] } }) => Promise<Scene | null>;
  reset: () => void;
}

let seq = 0;
const id = () => `m${++seq}`;

/** Messages d'erreur selon le code renvoyé par la fonction. */
export function aiErrorMessage(err: unknown): { text: string; notConfigured: boolean; reserved?: boolean } {
  const code = (err as { code?: string }).code ?? '';
  const message = (err as { message?: string }).message ?? '';
  const reason = (err as { details?: { reason?: string } }).details?.reason;
  if (code === 'functions/permission-denied' && reason === 'ai-reserved') return { text: message, notConfigured: false, reserved: true };
  if (code === 'functions/not-found' || code === 'functions/failed-precondition' || code === 'functions/internal' && /CORS|not found/i.test(message)) {
    return { text: 'Mode IA non configuré.', notConfigured: true };
  }
  if (code === 'functions/unauthenticated') return { text: 'Connectez-vous avec Google pour utiliser l’IA.', notConfigured: false };
  if (code === 'functions/resource-exhausted' || code === 'functions/permission-denied' || code === 'functions/aborted' || code === 'functions/invalid-argument' || code === 'functions/unavailable')
    return { text: message, notConfigured: false };
  if (code === 'functions/deadline-exceeded') return { text: 'La génération a pris trop de temps. Simplifiez la demande et réessayez.', notConfigured: false };
  return { text: 'Le service IA ne répond pas. Vérifiez votre connexion et réessayez.', notConfigured: false };
}

async function callGenerate() {
  const app = await getFirebaseApp();
  if (!app) throw Object.assign(new Error('Mode IA non configuré.'), { code: 'functions/not-found' });
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  return httpsCallable<unknown, { scene: Scene; summary: string }>(getFunctions(app, FUNCTIONS_REGION), 'generateScene', { timeout: 300_000 });
}

export const useAiStore = create<AiState>()((set, get) => ({
  access: 'unknown',
  accessFor: null,
  async checkAccess(uid) {
    if (get().accessFor === uid) return;
    set({ accessFor: uid, access: 'unknown' });
    try {
      const call = await callGenerate();
      await call({ check: true });
      if (get().accessFor === uid) set({ access: 'allowed' });
    } catch (err) {
      const { notConfigured, reserved } = aiErrorMessage(err);
      // hors ligne ou erreur passagère : on revérifiera à la prochaine visite
      if (get().accessFor === uid) set({ access: reserved ? 'reserved' : notConfigured ? 'off' : 'unknown', accessFor: reserved || notConfigured ? uid : null });
    }
  },
  messages: [],
  pending: false,
  scene: null,
  version: 0,
  async send({ prompt, image, currentScene, printer }) {
    if (get().pending || !prompt.trim()) return null;
    const history = get()
      .messages.filter((m) => !m.error)
      .slice(-8)
      .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
    set((s) => ({ pending: true, messages: [...s.messages, { id: id(), role: 'user', text: prompt.trim(), image: image?.preview }] }));
    try {
      const call = await callGenerate();
      const res = await call({
        prompt: prompt.trim(),
        imageBase64: image?.data,
        imageMediaType: image?.mediaType,
        currentScene: currentScene ?? get().scene ?? undefined,
        history,
        printer,
      });
      const version = get().version + 1;
      set((s) => ({
        pending: false,
        scene: res.data.scene,
        version,
        messages: [...s.messages, { id: id(), role: 'assistant', text: res.data.summary, scene: res.data.scene, version }],
      }));
      return res.data.scene;
    } catch (err) {
      const { text, reserved } = aiErrorMessage(err);
      set((s) => ({ pending: false, ...(reserved ? { access: 'reserved' as const } : {}), messages: [...s.messages, { id: id(), role: 'assistant', text, error: true }] }));
      return null;
    }
  },
  reset: () => set({ messages: [], scene: null, version: 0, pending: false }),
}));
