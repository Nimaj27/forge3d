import { useSyncExternalStore } from 'react';

/** Renvoie vrai si la media query correspond (mise à jour en direct). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Point de bascule ordinateur / téléphone (aligné sur layout.css). */
export const DESKTOP_QUERY = '(min-width: 900px)';

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
