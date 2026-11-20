/** Modèle « Porte-clés » : forme, texte, motif, anneau, bordure, bicolore. */
import { z } from 'zod';
import { FONT_IDS, type Loop } from '../../shared/scene';
import { circleLoop, heartLoop, rectLoop, shieldLoop, starLoop } from './shapes';
import { obj, snapToLayer, templateScene, type TemplateDef } from './types';

export const schema = z.object({
  forme: z.enum(['rond', 'rectangle', 'ecusson']).default('rond'),
  taille: z.number().min(20).max(90).default(40),
  epaisseur: z.number().min(1.6).max(8).default(3),
  texte: z.string().max(40).default('PACY'),
  police: z.enum(FONT_IDS).default('classique'),
  hauteurLettres: z.number().min(3).max(30).default(8.5),
  relief: z.number().min(0.4).max(4).default(1.5),
  motif: z.enum(['aucun', 'etoile', 'coeur']).default('etoile'),
  bordure: z.boolean().default(true),
  largeurBordure: z.number().min(0.8).max(5).default(1.5),
  diametreAnneau: z.number().min(8).max(25).default(13),
  trouAnneau: z.number().min(3).max(12).default(5.2),
  bicolore: z.boolean().default(true),
});
export type PorteClesParams = z.output<typeof schema>;
export const defaults: PorteClesParams = schema.parse({});

/** Contour de la forme, éventuellement rétréci de `inset`. */
function outline(p: PorteClesParams, inset: number): { loop: Loop; top: number } {
  const t = p.taille;
  if (p.forme === 'rectangle') {
    const h = t * 0.62;
    return { loop: rectLoop(t - 2 * inset, h - 2 * inset, Math.max(0, 5 - inset)), top: h / 2 };
  }
  if (p.forme === 'ecusson') return { loop: shieldLoop(t * 0.85, t, inset, [0, t / 2]), top: t / 2 };
  return { loop: circleLoop(t / 2 - inset), top: t / 2 };
}

export const porteCles: TemplateDef<PorteClesParams> = {
  id: 'porte-cles',
  name: 'Porte-clés',
  defaults,
  schema,
  sections: [
    { id: 'forme', label: 'Forme', objects: ['base', 'bordure'] },
    { id: 'texte', label: 'Texte et motif', objects: ['texte', 'motif'] },
    { id: 'anneau', label: 'Anneau', objects: ['anneau', 'trou-anneau'] },
  ],
  fields: [
    {
      key: 'forme',
      label: 'Forme',
      type: 'select',
      section: 'forme',
      options: [
        { value: 'rond', label: 'Rond' },
        { value: 'rectangle', label: 'Rectangle arrondi' },
        { value: 'ecusson', label: 'Écusson' },
      ],
    },
    { key: 'taille', label: 'Taille', type: 'slider', section: 'forme', min: 20, max: 90, step: 1, unit: 'mm' },
    { key: 'epaisseur', label: 'Épaisseur', type: 'number', section: 'forme', min: 1.6, max: 8, step: 0.2, unit: 'mm' },
    { key: 'bordure', label: 'Bordure en relief', type: 'toggle', section: 'forme' },
    { key: 'largeurBordure', label: 'Largeur de la bordure', type: 'slider', section: 'forme', min: 0.8, max: 4, step: 0.1, unit: 'mm', showIf: (p) => p.bordure },
    { key: 'texte', label: 'Texte', type: 'text', section: 'texte' },
    { key: 'police', label: 'Police', type: 'font', section: 'texte' },
    { key: 'hauteurLettres', label: 'Hauteur des lettres', type: 'slider', section: 'texte', min: 3, max: 25, step: 0.1, unit: 'mm' },
    { key: 'relief', label: 'Relief', type: 'slider', section: 'texte', min: 0.4, max: 4, step: 0.1, unit: 'mm' },
    {
      key: 'motif',
      label: 'Motif',
      type: 'select',
      section: 'texte',
      options: [
        { value: 'aucun', label: 'Aucun' },
        { value: 'etoile', label: 'Étoile' },
        { value: 'coeur', label: 'Cœur' },
      ],
    },
    { key: 'bicolore', label: 'Bicolore (pause au-dessus du disque)', type: 'toggle', section: 'texte' },
    { key: 'diametreAnneau', label: 'Ø de l’anneau', type: 'slider', section: 'anneau', min: 8, max: 25, step: 0.5, unit: 'mm' },
    { key: 'trouAnneau', label: 'Ø du trou', type: 'slider', section: 'anneau', min: 3, max: 12, step: 0.1, unit: 'mm' },
  ],
  build(p, printer) {
    const ep = snapToLayer(p.epaisseur);
    const top = ep - 0.5;
    const { loop, top: yTop } = outline(p, 0);
    const objects: Record<string, unknown>[] = [obj('base', 'Disque', 'sketch', { loops: [loop], op: 'extrude', height: ep })];
    const ra = p.diametreAnneau / 2;
    const rt = Math.min(p.trouAnneau / 2, ra - 1.2);
    const yRing = yTop + rt + 0.4;
    objects.push(obj('anneau', 'Anneau', 'cylinder', { radius: ra, height: ep, segments: 64 }, { position: [0, yRing, 0] }));
    objects.push(obj('trou-anneau', 'Trou de l’anneau', 'cylinder', { radius: rt, height: ep + 2, segments: 48 }, { position: [0, yRing, -1] }, 'hole'));
    if (p.bordure) {
      const outer = outline(p, 0.8).loop;
      const inner = outline(p, 0.8 + p.largeurBordure).loop;
      objects.push(obj('bordure', 'Bordure', 'sketch', { loops: [outer, inner], op: 'extrude', height: p.relief + 0.5 }, { position: [0, 0, top] }));
    }
    const hasMotif = p.motif !== 'aucun';
    const textY = hasMotif && p.texte.trim() ? -p.hauteurLettres * 0.35 : 0;
    if (p.texte.trim()) {
      objects.push(obj('texte', 'Texte', 'text', { text: p.texte, font: p.police, capHeight: p.hauteurLettres, depth: p.relief + 0.5 }, { position: [0, textY, top] }));
    }
    if (hasMotif) {
      const size = Math.max(5, p.hauteurLettres * 0.9);
      const y = p.texte.trim() ? textY + p.hauteurLettres / 2 + size * 0.75 : 0;
      const loopM = p.motif === 'etoile' ? starLoop(size / 2, size / 4.6, 5, [0, y]) : heartLoop(size, [0, y]);
      objects.push(obj('motif', p.motif === 'etoile' ? 'Étoile' : 'Cœur', 'sketch', { loops: [loopM], op: 'extrude', height: p.relief + 0.5 }, { position: [0, 0, top] }));
    }
    return templateScene('porte-cles', `Porte-clés ${p.texte}`.trim(), printer, [{ id: 'porte-cles', name: 'Porte-clés', objects, colorChanges: p.bicolore ? [ep] : undefined }], p);
  },
};
