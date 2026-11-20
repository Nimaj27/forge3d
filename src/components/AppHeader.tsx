import type { ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router';
import { ExportButton } from './ExportButton';
import { Icon, Logo, type IconName } from './Icon';
import { PrinterSelect } from './PrinterSelect';

export const NAV_ITEMS: { to: string; label: string; short: string; icon: IconName }[] = [
  { to: '/modeles', label: 'Modèles', short: 'Modèles', icon: 'cube' },
  { to: '/editeur', label: 'Éditeur', short: 'Éditeur', icon: 'pencil' },
  { to: '/atelier', label: 'Atelier', short: 'Atelier', icon: 'compass' },
  { to: '/ia', label: 'Créer avec l’IA', short: 'IA', icon: 'sparkle' },
  { to: '/projets', label: 'Mes projets', short: 'Projets', icon: 'folder' },
];

/** En-tête ordinateur (60 px) : logo, navigation, imprimante, action principale. */
export function AppHeader({ actions }: { actions?: ReactNode }) {
  const { pathname } = useLocation();
  const canExport = ['/editeur', '/atelier', '/ia'].some((p) => pathname.startsWith(p));
  return (
    <header className="app-header only-desktop">
      <Link to="/modeles" className="brand" aria-label="Forge3D, accueil">
        <Logo />
        <span className="brand__name">Forge3D</span>
      </Link>
      <nav aria-label="Navigation principale" className="main-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="app-header__spacer" />
      <PrinterSelect />
      {actions}
      {canExport && <ExportButton />}
    </header>
  );
}
