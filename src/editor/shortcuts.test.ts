import { describe, expect, it, vi } from 'vitest';
import { useSceneStore } from '../store/sceneStore';
import { handleShortcut, SHORTCUTS } from './shortcuts';

function key(k: string, mods: { ctrl?: boolean; shift?: boolean; alt?: boolean } = {}) {
  return {
    key: k,
    ctrlKey: !!mods.ctrl,
    metaKey: false,
    shiftKey: !!mods.shift,
    altKey: !!mods.alt,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('raccourcis clavier', () => {
  it('chaque raccourci est décrit (touches, action, écran) et unique', () => {
    const keys = SHORTCUTS.map((s) => s.keys);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of SHORTCUTS) expect(s.keys && s.label && s.where).toBeTruthy();
  });

  it('Ctrl+D, Ctrl+G et Ctrl+Maj+G appellent les actions de l’atelier', () => {
    const extra = { duplicate: vi.fn(), group: vi.fn(), ungroup: vi.fn() };
    expect(handleShortcut(key('d', { ctrl: true }), extra)?.keys).toBe('Ctrl + D');
    handleShortcut(key('g', { ctrl: true }), extra);
    handleShortcut(key('G', { ctrl: true, shift: true }), extra);
    expect(extra.duplicate).toHaveBeenCalledOnce();
    expect(extra.group).toHaveBeenCalledOnce();
    expect(extra.ungroup).toHaveBeenCalledOnce();
  });

  it('dans l’éditeur (sans actions d’atelier), Ctrl+D ne fait rien', () => {
    expect(handleShortcut(key('d', { ctrl: true }), {})).toBeNull();
  });

  it('Ctrl+Z annule ; Ctrl+Maj+Z et Ctrl+Y rétablissent', () => {
    expect(handleShortcut(key('z', { ctrl: true }), {})?.label).toMatch(/Annuler/);
    expect(handleShortcut(key('Z', { ctrl: true, shift: true }), {})?.label).toBe('Rétablir');
    expect(handleShortcut(key('y', { ctrl: true }), {})?.label).toBe('Rétablir');
  });

  it('les flèches déplacent la sélection (Maj : 10 mm, Alt : en hauteur)', () => {
    const nudge = vi.fn();
    expect(handleShortcut(key('ArrowLeft'), { nudge })).toBeNull(); // rien de sélectionné
    useSceneStore.setState({ selection: ['x'] });
    handleShortcut(key('ArrowLeft'), { nudge });
    handleShortcut(key('ArrowUp', { shift: true }), { nudge });
    handleShortcut(key('ArrowDown', { alt: true }), { nudge });
    expect(nudge.mock.calls).toEqual([
      [-1, 0, 0],
      [0, 10, 0],
      [0, 0, -1],
    ]);
    useSceneStore.setState({ selection: [] });
  });
});
