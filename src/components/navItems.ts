/** Écrans principaux (menu de l'en-tête ; liste partagée avec le mode d'emploi généré). */
import type { IconName } from './Icon';

export const NAV_ITEMS: { to: string; label: string; short: string; icon: IconName }[] = [
  { to: '/modeles', label: 'Modèles', short: 'Modèles', icon: 'cube' },
  { to: '/editeur', label: 'Éditeur', short: 'Éditeur', icon: 'pencil' },
  { to: '/atelier', label: 'Atelier', short: 'Atelier', icon: 'compass' },
  { to: '/ia', label: 'Créer avec l’IA', short: 'IA', icon: 'sparkle' },
  { to: '/projets', label: 'Mes projets', short: 'Projets', icon: 'folder' },
];

