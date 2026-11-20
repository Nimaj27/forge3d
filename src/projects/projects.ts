/**
 * Projets : autosauvegarde locale (IndexedDB), projets en ligne (Firestore), fichiers .forge3d.json.
 */
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { safeParseScene, type Scene } from '../../shared/scene';
import { getFirebaseApp } from '../firebase/app';
import { downloadBlob, safeFileName } from '../lib/download';
import { useSceneStore } from '../store/sceneStore';

const AUTOSAVE_KEY = 'forge3d-autosave';
/** Taille maximale d'un projet en ligne (un document Firestore fait au plus 1 Mio). */
export const MAX_PROJECT_BYTES = 900_000;

// ---------------------------------------------------------------------------
// Fichiers .forge3d.json
// ---------------------------------------------------------------------------

export function sceneToFile(scene: Scene): Blob {
  return new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
}

export function exportProjectFile(scene: Scene): void {
  downloadBlob(sceneToFile(scene), `${safeFileName(scene.name)}.forge3d.json`);
}

/** Lit et valide un fichier de projet ; message clair si invalide. */
export function parseProjectText(text: string): Scene {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier n’est pas un projet Forge3D (JSON illisible).');
  }
  const res = safeParseScene(data);
  if (!res.success) throw new Error('Ce fichier n’est pas un projet Forge3D valide.');
  return res.data;
}

export async function importProjectFile(file: File): Promise<Scene> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Fichier trop lourd.');
  return parseProjectText(await file.text());
}

// ---------------------------------------------------------------------------
// Autosauvegarde locale
// ---------------------------------------------------------------------------

export interface Autosave {
  scene: Scene;
  savedAt: number;
}

export async function readAutosave(): Promise<Autosave | null> {
  try {
    const raw = await idbGet<Autosave>(AUTOSAVE_KEY);
    if (!raw) return null;
    const res = safeParseScene(raw.scene);
    return res.success ? { scene: res.data, savedAt: raw.savedAt } : null;
  } catch {
    return null;
  }
}

/** Restaure le travail au démarrage, puis enregistre chaque modification (après 1 s de calme). */
export function useAutosave(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ready = false;
    const save = () => void idbSet(AUTOSAVE_KEY, { scene: useSceneStore.getState().scene, savedAt: Date.now() } satisfies Autosave).catch(() => undefined);
    void readAutosave().then((saved) => {
      // restaure seulement si rien n'a encore été ouvert (un modèle demandé dans l'URL est prioritaire)
      if (saved && useSceneStore.getState().sceneVersion === 0) useSceneStore.getState().setScene(saved.scene);
      else save(); // une scène ouverte pendant la lecture doit aussi être enregistrée
      ready = true;
    });
    const unsub = useSceneStore.subscribe((s, prev) => {
      if (!ready || s.scene === prev.scene) return;
      clearTimeout(timer);
      timer = setTimeout(save, 1000);
    });
    // passage en arrière-plan (téléphone) : enregistrement immédiat
    const onHide = () => {
      if (ready && document.visibilityState === 'hidden') {
        clearTimeout(timer);
        save();
      }
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      unsub();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);
}

// ---------------------------------------------------------------------------
// Projets en ligne (Firestore : users/{uid}/projects/{id})
// ---------------------------------------------------------------------------

export interface CloudProject {
  id: string;
  name: string;
  thumbnail?: string;
  updatedAt: Date | null;
}

/** Projet en ligne actuellement ouvert (pour enregistrer par-dessus). */
export const useCurrentProject = create<{ id: string | null; setId: (id: string | null) => void }>()(
  persist((set) => ({ id: null, setId: (id) => set({ id }) }), { name: 'forge3d-current-project' }),
);

async function db() {
  const app = await getFirebaseApp();
  if (!app) throw new Error('Sauvegarde en ligne indisponible (Firebase non configuré).');
  const fs = await import('firebase/firestore');
  const { getAuth } = await import('firebase/auth');
  const user = getAuth(app).currentUser;
  if (!user) throw new Error('Connectez-vous avec Google pour enregistrer en ligne.');
  return { fs, firestore: fs.getFirestore(app), uid: user.uid };
}

export async function listProjects(): Promise<CloudProject[]> {
  const { fs, firestore, uid } = await db();
  const q = fs.query(fs.collection(firestore, 'users', uid, 'projects'), fs.orderBy('updatedAt', 'desc'), fs.limit(100));
  const snap = await fs.getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as { name: string; thumbnail?: string; updatedAt?: { toDate(): Date } };
    return { id: d.id, name: data.name, thumbnail: data.thumbnail, updatedAt: data.updatedAt?.toDate() ?? null };
  });
}

export async function saveProject(scene: Scene, thumbnail: string | undefined, id?: string | null): Promise<string> {
  const json = JSON.stringify(scene);
  if (json.length > MAX_PROJECT_BYTES) throw new Error('Projet trop lourd pour être enregistré en ligne (images trop grandes). Utilisez l’export .forge3d.json.');
  const { fs, firestore, uid } = await db();
  const data = {
    name: (scene.name || 'Sans titre').slice(0, 120),
    scene: json,
    ...(thumbnail && thumbnail.length <= 200_000 ? { thumbnail } : {}),
    updatedAt: fs.serverTimestamp(),
  };
  const col = fs.collection(firestore, 'users', uid, 'projects');
  if (id) {
    await fs.setDoc(fs.doc(col, id), data);
    return id;
  }
  const ref = await fs.addDoc(col, data);
  return ref.id;
}

export async function loadProject(id: string): Promise<Scene> {
  const { fs, firestore, uid } = await db();
  const snap = await fs.getDoc(fs.doc(firestore, 'users', uid, 'projects', id));
  if (!snap.exists()) throw new Error('Projet introuvable.');
  return parseProjectText((snap.data() as { scene: string }).scene);
}

export async function deleteProject(id: string): Promise<void> {
  const { fs, firestore, uid } = await db();
  await fs.deleteDoc(fs.doc(firestore, 'users', uid, 'projects', id));
}

/** Miniature (JPEG ~240 px) de l'aperçu 3D visible, si présent. */
export function captureThumbnail(): string | undefined {
  const canvas = document.querySelector<HTMLCanvasElement>('.viewer-frame canvas, .m-editor__viewer canvas');
  if (!canvas || !canvas.width) return undefined;
  const scale = 240 / Math.max(canvas.width, canvas.height);
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  const ctx = c.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.75);
}
