import type { ReactNode } from 'react';
import { NavLink, Link, useLocation } from 'react-router';
import { AtelierModeSwitch } from './AtelierModeSwitch';
import { ExportButton } from './ExportButton';
import { useAiStore } from '../ai/aiStore';
import { Icon, Logo } from './Icon';
import { NAV_ITEMS } from './navItems';
import { PrinterSelect } from './PrinterSelect';

/** En-tête ordinateur (60 px) : logo, navigation, imprimante, action principale. */
export function AppHeader({ actions }: { actions?: ReactNode }) {
  const { pathname } = useLocation();
  const aiReady = useAiStore((s) => !!s.scene);
  const canExport = ['/editeur', '/atelier'].some((p) => pathname.startsWith(p)) || (pathname.startsWith('/ia') && aiReady);
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
      {pathname.startsWith('/atelier') && <AtelierModeSwitch />}
      <PrinterSelect compact={pathname.startsWith('/atelier')} />
      {actions}
      {canExport && <ExportButton />}
    </header>
  );
}
