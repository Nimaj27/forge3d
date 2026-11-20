/**
 * État du croquis 2D en cours (en mémoire, conservé en changeant d'écran), avec annuler / rétablir.
 */
import { create, useStore } from 'zustand';
import { temporal } from 'zundo';
import type { SceneObject } from '../../shared/scene';
import { loopToShape, type SketchShape } from './model';

export type SketchTool = 'select' | 'line' | 'curve' | 'arc' | 'circle' | 'rect' | 'polygon';

export interface SketchState {
  shapes: SketchShape[];
  op: 'extrude' | 'revolve';
  height: number;
  angle: number;
  segments: number;
  name: string;
  /** Objet de la scène en cours de modification (sinon : nouveau croquis) */
  editingObjectId: string | null;
  selectedShape: string | null;
  selectedVertex: number | null;

  setShapes: (fn: (shapes: SketchShape[]) => SketchShape[]) => void;
  addShapes: (shapes: SketchShape[]) => void;
  updateShape: (id: string, fn: (s: SketchShape) => SketchShape) => void;
  removeShape: (id: string) => void;
  select: (shapeId: string | null, vertex?: number | null) => void;
  setParams: (patch: Partial<Pick<SketchState, 'op' | 'height' | 'angle' | 'segments' | 'name'>>) => void;
  loadObject: (obj: Extract<SceneObject, { kind: 'sketch' }>) => void;
  reset: () => void;
}

function coalesce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: never[]) => {
    const t = Date.now();
    if (t - last > ms) fn(...args);
    last = t;
  }) as T;
}

const INITIAL = {
  shapes: [] as SketchShape[],
  op: 'extrude' as const,
  height: 10,
  angle: 360,
  segments: 96,
  name: 'Croquis',
  editingObjectId: null as string | null,
  selectedShape: null as string | null,
  selectedVertex: null as number | null,
};

export const useSketchStore = create<SketchState>()(
  temporal(
    (set) => ({
      ...INITIAL,
      setShapes: (fn) => set((s) => ({ shapes: fn(s.shapes) })),
      addShapes: (shapes) => set((s) => ({ shapes: [...s.shapes, ...shapes], selectedShape: shapes[shapes.length - 1]?.id ?? null, selectedVertex: null })),
      updateShape: (id, fn) => set((s) => ({ shapes: s.shapes.map((x) => (x.id === id ? fn(x) : x)) })),
      removeShape: (id) =>
        set((s) => ({ shapes: s.shapes.filter((x) => x.id !== id), selectedShape: s.selectedShape === id ? null : s.selectedShape, selectedVertex: null })),
      select: (shapeId, vertex = null) => set({ selectedShape: shapeId, selectedVertex: vertex }),
      setParams: (patch) => set(patch),
      loadObject: (obj) => {
        set({
          shapes: obj.params.loops.map(loopToShape),
          op: obj.params.op,
          height: obj.params.height,
          angle: obj.params.angle,
          segments: obj.params.segments,
          name: obj.name || 'Croquis',
          editingObjectId: obj.id,
          selectedShape: null,
          selectedVertex: null,
        });
        useSketchStore.temporal.getState().clear();
      },
      reset: () => {
        set({ ...INITIAL });
        useSketchStore.temporal.getState().clear();
      },
    }),
    {
      limit: 100,
      partialize: (s) => ({ shapes: s.shapes }),
      equality: (a, b) => a.shapes === b.shapes,
      handleSet: (handleSet) => coalesce(handleSet, 350),
    },
  ),
);

export function useSketchHistory() {
  const past = useStore(useSketchStore.temporal, (s) => s.pastStates.length);
  const future = useStore(useSketchStore.temporal, (s) => s.futureStates.length);
  const { undo, redo } = useSketchStore.temporal.getState();
  return { canUndo: past > 0, canRedo: future > 0, undo: () => undo(), redo: () => redo() };
}
