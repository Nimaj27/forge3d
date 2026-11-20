/** Outils de dessin du croquis 2D (liste partagée avec le mode d'emploi généré). */
import type { IconName } from '../components/Icon';
import type { SketchTool } from './sketchStore';

export const DRAW_TOOLS: { value: SketchTool; label: string; icon: IconName }[] = [
  { value: 'line', label: 'Ligne', icon: 'line' },
  { value: 'curve', label: 'Courbe', icon: 'curve' },
  { value: 'arc', label: 'Arc', icon: 'arc' },
  { value: 'circle', label: 'Cercle', icon: 'circle' },
  { value: 'rect', label: 'Rectangle', icon: 'rect' },
  { value: 'polygon', label: 'Polygone', icon: 'polygon' },
];
