import { NavLink, useLocation } from 'react-router';
import { Icon, type IconName } from './Icon';

const ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: '/modeles', label: 'Modèles', icon: 'cube' },
  { to: '/atelier', label: 'Atelier', icon: 'compass' },
  { to: '/ia', label: 'IA', icon: 'sparkle' },
  { to: '/projets', label: 'Projets', icon: 'folder' },
];

/** Barre de navigation du téléphone : 4 onglets. */
export function BottomNav() {
  const { pathname } = useLocation();
  // L'éditeur a sa propre barre d'actions (annuler, exporter)
  if (pathname.startsWith('/editeur')) return null;
  return (
    <nav aria-label="Navigation" className="bottom-nav only-mobile">
      {ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to}>
          <Icon name={item.icon} size={22} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
