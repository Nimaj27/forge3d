/** Raccourcis clavier communs à l'éditeur et à l'atelier (la liste est dans shortcuts.ts). */
import { useEffect, useRef } from 'react';
import { handleShortcut, type ExtraShortcuts } from './shortcuts';

export type { ExtraShortcuts } from './shortcuts';

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
      handleShortcut(e, ref.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
