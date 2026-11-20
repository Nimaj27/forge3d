/** Formes et outils de l'atelier (listes partagées avec le mode d'emploi généré). */
import type { ObjectKind } from '../../shared/scene';
import type { IconName } from '../components/Icon';
import type { GizmoTool } from './AtelierViewer';

export const SHAPES: { kind: Exclude<ObjectKind, 'group' | 'sketch' | 'image' | 'svg'>; label: string; icon: IconName; width: number }[] = [
  { kind: 'box', label: 'Cube', icon: 'box', width: 20 },
  { kind: 'cylinder', label: 'Cylindre', icon: 'cylinder', width: 20 },
  { kind: 'sphere', label: 'Sphère', icon: 'sphere', width: 20 },
  { kind: 'cone', label: 'Cône', icon: 'cone', width: 20 },
  { kind: 'tube', label: 'Tube', icon: 'tube', width: 20 },
  { kind: 'text', label: 'Texte', icon: 'text', width: 40 },
];

export const GIZMO_TOOLS: { value: GizmoTool; label: string; icon: IconName }[] = [
  { value: 'translate', label: 'Déplacer', icon: 'move' },
  { value: 'rotate', label: 'Tourner', icon: 'rotate' },
  { value: 'scale', label: 'Redimensionner', icon: 'scale' },
];
