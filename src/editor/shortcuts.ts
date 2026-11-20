/**
 * Raccourcis clavier de l'éditeur et de l'atelier.
 * Une seule liste sert au clavier (useShortcuts) et au mode d'emploi généré : ajouter un raccourci ici
 * le documente automatiquement.
 */
import { findObject } from '../scene/ops';
import { useSceneStore } from '../store/sceneStore';

/** Actions propres à un écran (l'atelier les fournit, l'éditeur non). */
export interface ExtraShortcuts {
  duplicate?: () => void;
  group?: () => void;
  ungroup?: () => void;
  /** Déplacement fin de la sélection (mm) */
  nudge?: (dx: number, dy: number, dz: number) => void;
}

export interface ShortcutContext {
  e: KeyboardEvent;
  /** Ctrl (ou Cmd sur Mac) enfoncé */
  mod: boolean;
  /** Touche en minuscules */
  key: string;
  extra: ExtraShortcuts;
}

export interface Shortcut {
  /** Touches, telles qu'affichées dans le mode d'emploi */
  keys: string;
  /** Action, en français */
  label: string;
  /** Écrans où le raccourci est disponible */
  where: 'Éditeur et atelier' | 'Atelier';
  matches: (c: ShortcutContext) => boolean;
  run: (c: ShortcutContext) => void;
}

const temporal = () => useSceneStore.temporal.getState();

export const SHORTCUTS: Shortcut[] = [
  {
    keys: 'Ctrl + Z',
    label: 'Annuler la dernière modification',
    where: 'Éditeur et atelier',
    matches: ({ mod, key, e }) => mod && key === 'z' && !e.shiftKey,
    run: ({ e }) => {
      e.preventDefault();
      temporal().undo();
    },
  },
  {
    keys: 'Ctrl + Maj + Z ou Ctrl + Y',
    label: 'Rétablir',
    where: 'Éditeur et atelier',
    matches: ({ mod, key, e }) => mod && ((key === 'z' && e.shiftKey) || key === 'y'),
    run: ({ e }) => {
      e.preventDefault();
      temporal().redo();
    },
  },
  {
    keys: 'Ctrl + D',
    label: 'Dupliquer la sélection',
    where: 'Atelier',
    matches: ({ mod, key, extra }) => mod && key === 'd' && !!extra.duplicate,
    run: ({ e, extra }) => {
      e.preventDefault();
      extra.duplicate?.();
    },
  },
  {
    keys: 'Ctrl + G',
    label: 'Grouper la sélection',
    where: 'Atelier',
    matches: ({ mod, key, e, extra }) => mod && key === 'g' && !e.shiftKey && !!extra.group,
    run: ({ e, extra }) => {
      e.preventDefault();
      extra.group?.();
    },
  },
  {
    keys: 'Ctrl + Maj + G',
    label: 'Dégrouper',
    where: 'Atelier',
    matches: ({ mod, key, e, extra }) => mod && key === 'g' && e.shiftKey && !!extra.ungroup,
    run: ({ e, extra }) => {
      e.preventDefault();
      extra.ungroup?.();
    },
  },
  {
    keys: 'Suppr ou Retour arrière',
    label: 'Supprimer la sélection (sauf les éléments verrouillés)',
    where: 'Éditeur et atelier',
    matches: ({ e }) => e.key === 'Delete' || e.key === 'Backspace',
    run: ({ e }) => {
      const { selection, removeObjects, scene } = useSceneStore.getState();
      const removable = selection.filter((id) => !findObject(scene, id)?.object.locked);
      if (removable.length) {
        e.preventDefault();
        removeObjects(removable);
      }
    },
  },
  {
    keys: 'Échap',
    label: 'Tout désélectionner',
    where: 'Éditeur et atelier',
    matches: ({ e }) => e.key === 'Escape',
    run: () => useSceneStore.getState().select([]),
  },
  {
    keys: 'Flèches',
    label: 'Déplacer la sélection de 1 mm (Maj : 10 mm ; Alt + ↑ / ↓ : en hauteur)',
    where: 'Atelier',
    matches: ({ e, extra }) => !!extra.nudge && e.key.startsWith('Arrow') && useSceneStore.getState().selection.length > 0,
    run: ({ e, extra }) => {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const nudge = extra.nudge!;
      if (e.key === 'ArrowLeft') nudge(-step, 0, 0);
      if (e.key === 'ArrowRight') nudge(step, 0, 0);
      if (e.key === 'ArrowUp') {
        if (e.altKey) nudge(0, 0, step);
        else nudge(0, step, 0);
      }
      if (e.key === 'ArrowDown') {
        if (e.altKey) nudge(0, 0, -step);
        else nudge(0, -step, 0);
      }
    },
  },
];

/** Exécute le premier raccourci correspondant à la touche ; renvoie celui-ci (ou null). */
export function handleShortcut(e: KeyboardEvent, extra: ExtraShortcuts): Shortcut | null {
  const ctx: ShortcutContext = { e, mod: e.ctrlKey || e.metaKey, key: e.key.toLowerCase(), extra };
  const shortcut = SHORTCUTS.find((s) => s.matches(ctx)) ?? null;
  shortcut?.run(ctx);
  return shortcut;
}
