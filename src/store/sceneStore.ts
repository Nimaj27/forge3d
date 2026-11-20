/**
 * État de la scène en cours d'édition, avec annuler / rétablir (zundo).
 * Partagé par l'Éditeur et l'Atelier : une seule scène ouverte à la fois.
 */
import { create } from 'zustand';
import { temporal } from 'zundo';
import { useStore } from 'zustand';
import type { Part, Scene, SceneObject, Transform } from '../../shared/scene';
import { DEFAULT_PRINTER_ID, PRINTERS } from '../lib/printers';
import { demoScene } from '../scene/factory';
import * as ops from '../scene/ops';

export interface SceneState {
  scene: Scene;
  /** Objets sélectionnés (identifiants) */
  selection: string[];
  /** Pièce active (ajouts, propriétés) */
  activePartId: string;
  /** Incrémenté à chaque remplacement complet de la scène (recadrage de la caméra) */
  sceneVersion: number;

  setScene: (scene: Scene, opts?: { keepHistory?: boolean }) => void;
  /** Modification libre (enregistrée dans l'historique) */
  update: (fn: (scene: Scene) => Scene) => void;
  updateObject: (id: string, fn: (o: SceneObject) => SceneObject) => void;
  patchParams: (id: string, patch: Record<string, unknown>) => void;
  patchTransform: (id: string, patch: Partial<Transform>) => void;
  updatePart: (partId: string, fn: (p: Part) => Part) => void;
  addObject: (obj: SceneObject, partId?: string) => void;
  removeObjects: (ids: string[]) => void;
  select: (ids: string[]) => void;
  toggleSelect: (id: string) => void;
  setActivePart: (partId: string) => void;
  rename: (name: string) => void;
}

const defaultPrinter = PRINTERS.find((p) => p.id === DEFAULT_PRINTER_ID)!;
const initial = demoScene({ id: defaultPrinter.id, bed: defaultPrinter.bed });

/** Regroupe les modifications rapprochées (glisser un curseur) en une seule étape d'historique. */
function coalesce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: never[]) => {
    const t = Date.now();
    if (t - last > ms) fn(...args);
    last = t;
  }) as T;
}

export const useSceneStore = create<SceneState>()(
  temporal(
    (set, get) => ({
      scene: initial,
      selection: [],
      activePartId: initial.parts[0].id,
      sceneVersion: 0,

      setScene: (scene, opts) => {
        set((s) => ({
          scene,
          selection: [],
          activePartId: scene.parts[0]?.id ?? '',
          sceneVersion: s.sceneVersion + 1,
        }));
        if (!opts?.keepHistory) useSceneStore.temporal.getState().clear();
      },
      update: (fn) => set((s) => ({ scene: fn(s.scene) })),
      updateObject: (id, fn) => set((s) => ({ scene: ops.updateObject(s.scene, id, fn) })),
      patchParams: (id, patch) => set((s) => ({ scene: ops.patchParams(s.scene, id, patch) })),
      patchTransform: (id, patch) => set((s) => ({ scene: ops.patchTransform(s.scene, id, patch) })),
      updatePart: (partId, fn) => set((s) => ({ scene: ops.updatePart(s.scene, partId, fn) })),
      addObject: (obj, partId) =>
        set((s) => {
          const target = partId ?? s.activePartId;
          return { scene: ops.addObject(s.scene, obj, target), selection: [obj.id] };
        }),
      removeObjects: (ids) =>
        set((s) => ({ scene: ops.removeObjects(s.scene, ids), selection: s.selection.filter((i) => !ids.includes(i)) })),
      select: (ids) => {
        const first = ids[0] ? ops.partOfObject(get().scene, ids[0]) : undefined;
        set((s) => ({ selection: ids, activePartId: first?.id ?? s.activePartId }));
      },
      toggleSelect: (id) =>
        set((s) => ({ selection: s.selection.includes(id) ? s.selection.filter((i) => i !== id) : [...s.selection, id] })),
      setActivePart: (partId) => set({ activePartId: partId }),
      rename: (name) => set((s) => ({ scene: { ...s.scene, name } })),
    }),
    {
      limit: 100,
      partialize: (s) => ({ scene: s.scene }),
      equality: (a, b) => a.scene === b.scene,
      handleSet: (handleSet) => coalesce(handleSet, 400),
    },
  ),
);

/** Accès réactif à l'historique (annuler / rétablir). */
export function useHistory() {
  const pastCount = useStore(useSceneStore.temporal, (s) => s.pastStates.length);
  const futureCount = useStore(useSceneStore.temporal, (s) => s.futureStates.length);
  const { undo, redo } = useSceneStore.temporal.getState();
  return { canUndo: pastCount > 0, canRedo: futureCount > 0, undo: () => undo(), redo: () => redo() };
}

export function useActivePart(): Part | undefined {
  return useSceneStore((s) => s.scene.parts.find((p) => p.id === s.activePartId) ?? s.scene.parts[0]);
}

export function useSelectedObject(): SceneObject | null {
  return useSceneStore((s) => {
    const id = s.selection[0];
    return id ? (ops.findObject(s.scene, id)?.object ?? null) : null;
  });
}
