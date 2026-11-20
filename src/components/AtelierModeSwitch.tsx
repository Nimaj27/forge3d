import { NavLink } from 'react-router';

/** Bascule « Formes / Croquis 2D » de l'atelier (en-tête). */
export function AtelierModeSwitch({ compact }: { compact?: boolean }) {
  return (
    <div role="group" aria-label="Mode de l’atelier" className={`segmented segmented--inset ${compact ? 'segmented--compact' : ''}`}>
      <NavLink to="/atelier" end>
        Formes
      </NavLink>
      <NavLink to="/atelier/croquis">Croquis{compact ? '' : ' 2D'}</NavLink>
    </div>
  );
}
