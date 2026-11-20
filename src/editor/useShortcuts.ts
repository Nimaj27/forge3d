/** Raccourcis clavier communs à l'éditeur et à l'atelier. */
import { useEffect, useRef } from 'react';
import { findObject } from '../scene/ops';
import { useSceneStore } from '../store/sceneStore';

export interface ExtraShortcuts {
  duplicate?: () => void;
  group?: () => void;
  ungroup?: () => void;
  /** Déplacement fin de la sélection (mm) */
  nudge?: (dx: number, dy: number, dz: number) => void;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (!!el.closest('input, textarea, select, [contenteditable="true"]') || el.isContentEditable);
}

export function useShortcuts(extra: ExtraShortcuts = {}) {
  const ref = useRef(extra);
  useEffect(() => {
    ref.current = extra;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const temporal = useSceneStore.temporal.getState();
      const x = ref.current;
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) temporal.redo();
        else temporal.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        temporal.redo();
      } else if (mod && key === 'd' && x.duplicate) {
        e.preventDefault();
        x.duplicate();
      } else if (mod && key === 'g' && (x.group || x.ungroup)) {
        e.preventDefault();
        if (e.shiftKey) x.ungroup?.();
        else x.group?.();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selection, removeObjects, scene } = useSceneStore.getState();
        const removable = selection.filter((id) => !findObject(scene, id)?.object.locked);
        if (removable.length) {
          e.preventDefault();
          removeObjects(removable);
        }
      } else if (e.key === 'Escape') {
        useSceneStore.getState().select([]);
      } else if (x.nudge && e.key.startsWith('Arrow') && useSceneStore.getState().selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowLeft') x.nudge(-step, 0, 0);
        if (e.key === 'ArrowRight') x.nudge(step, 0, 0);
        if (e.key === 'ArrowUp') {
          if (e.altKey) x.nudge(0, 0, step);
          else x.nudge(0, step, 0);
        }
        if (e.key === 'ArrowDown') {
          if (e.altKey) x.nudge(0, 0, -step);
          else x.nudge(0, -step, 0);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
