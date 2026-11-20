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

interface AiState {
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
export function aiErrorMessage(err: unknown): { text: string; notConfigured: boolean } {
  const code = (err as { code?: string }).code ?? '';
  const message = (err as { message?: string }).message ?? '';
  if (code === 'functions/not-found' || code === 'functions/failed-precondition' || code === 'functions/internal' && /CORS|not found/i.test(message)) {
    return { text: 'Mode IA non configuré.', notConfigured: true };
  }
  if (code === 'functions/unauthenticated') return { text: 'Connectez-vous avec Google pour utiliser l’IA.', notConfigured: false };
  if (code === 'functions/resource-exhausted' || code === 'functions/permission-denied' || code === 'functions/aborted' || code === 'functions/invalid-argument' || code === 'functions/unavailable')
    return { text: message, notConfigured: false };
  if (code === 'functions/deadline-exceeded') return { text: 'La génération a pris trop de temps. Simplifiez la demande et réessayez.', notConfigured: false };
  return { text: 'Le service IA ne répond pas. Vérifiez votre connexion et réessayez.', notConfigured: false };
}

export const useAiStore = create<AiState>()((set, get) => ({
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
      const app = await getFirebaseApp();
      if (!app) throw Object.assign(new Error('Mode IA non configuré.'), { code: 'functions/not-found' });
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const call = httpsCallable<unknown, { scene: Scene; summary: string }>(getFunctions(app, FUNCTIONS_REGION), 'generateScene', { timeout: 300_000 });
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
      const { text } = aiErrorMessage(err);
      set((s) => ({ pending: false, messages: [...s.messages, { id: id(), role: 'assistant', text, error: true }] }));
      return null;
    }
  },
  reset: () => set({ messages: [], scene: null, version: 0, pending: false }),
}));
