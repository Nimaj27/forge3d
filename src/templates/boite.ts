/** Modèle « Boîte à couvercle » : dimensions intérieures, parois, jeu ; couvercle emboîtant ou coulissant. */
import { z } from 'zod';
import { rectLoop } from './shapes';
import { obj, snapToLayer, templateScene, type TemplateDef } from './types';

export const schema = z.object({
  longueur: z.number().min(10).max(200).default(80),
  largeur: z.number().min(10).max(200).default(60),
  hauteur: z.number().min(5).max(200).default(40),
  paroi: z.number().min(1.2).max(6).default(2),
  fond: z.number().min(1).max(6).default(2),
  jeu: z.number().min(0).max(1).default(0.2),
  arrondi: z.number().min(0).max(20).default(3),
  couvercle: z.enum(['emboitant', 'coulissant']).default('emboitant'),
});
export type BoiteParams = z.output<typeof schema>;
export const defaults: BoiteParams = schema.parse({});

export const boite: TemplateDef<BoiteParams> = {
  id: 'boite',
  name: 'Boîte à couvercle',
  defaults,
  schema,
  sections: [
    { id: 'boite', label: 'Boîte', objects: ['boite', 'interieur', 'rainure'] },
    { id: 'couvercle', label: 'Couvercle', objects: ['couvercle', 'levre', 'glissiere'] },
  ],
  fields: [
    { key: 'longueur', label: 'Longueur intérieure', type: 'number', section: 'boite', min: 10, max: 200, unit: 'mm' },
    { key: 'largeur', label: 'Largeur intérieure', type: 'number', section: 'boite', min: 10, max: 200, unit: 'mm' },
    { key: 'hauteur', label: 'Hauteur intérieure', type: 'number', section: 'boite', min: 5, max: 200, unit: 'mm' },
    { key: 'paroi', label: 'Épaisseur de paroi', type: 'slider', section: 'boite', min: 1.2, max: 6, step: 0.1, unit: 'mm' },
    { key: 'fond', label: 'Épaisseur du fond', type: 'slider', section: 'boite', min: 1, max: 6, step: 0.2, unit: 'mm' },
    { key: 'arrondi', label: 'Coins arrondis', type: 'slider', section: 'boite', min: 0, max: 20, step: 0.5, unit: 'mm' },
    {
      key: 'couvercle',
      label: 'Couvercle',
      type: 'select',
      section: 'couvercle',
      options: [
        { value: 'emboitant', label: 'Emboîtant' },
        { value: 'coulissant', label: 'Coulissant' },
      ],
    },
    { key: 'jeu', label: 'Jeu du couvercle', type: 'slider', section: 'couvercle', min: 0, max: 1, step: 0.05, unit: 'mm', help: '0,2 mm convient à la plupart des imprimantes.' },
  ],
  build(p, printer) {
    const L = p.longueur;
    const W = p.largeur;
    const w = p.paroi;
    const f = snapToLayer(p.fond);
    const r = p.arrondi;
    const rin = Math.max(0, r - w);
    const gap = 12;
    const box: Record<string, unknown>[] = [];
    const lid: Record<string, unknown>[] = [];
    const lidX = L + 2 * w + gap; // couvercle posé à côté de la boîte

    if (p.couvercle === 'emboitant') {
      const H = p.hauteur + f;
      box.push(obj('boite', 'Boîte', 'sketch', { loops: [rectLoop(L + 2 * w, W + 2 * w, r)], op: 'extrude', height: H }));
      box.push(obj('interieur', 'Intérieur', 'sketch', { loops: [rectLoop(L, W, rin)], op: 'extrude', height: H }, { position: [0, 0, f] }, 'hole'));
      const t = snapToLayer(2);
      const lipH = Math.min(8, Math.max(3, p.hauteur * 0.2));
      const lo = { w: L - 2 * p.jeu, h: W - 2 * p.jeu };
      lid.push(obj('couvercle', 'Couvercle', 'sketch', { loops: [rectLoop(L + 2 * w, W + 2 * w, r)], op: 'extrude', height: t }, { position: [lidX, 0, 0] }));
      lid.push(
        obj(
          'levre',
          'Lèvre d’emboîtement',
          'sketch',
          { loops: [rectLoop(lo.w, lo.h, rin), rectLoop(lo.w - 2 * w, lo.h - 2 * w, Math.max(0, rin - w))], op: 'extrude', height: lipH + 0.5 },
          { position: [lidX, 0, t - 0.5] },
        ),
      );
    } else {
      // Glissière : rainures dans les deux grandes parois, ouvertes sur une extrémité.
      const lidT = 1.6;
      const g = Math.min(1.2, w * 0.55); // profondeur de la rainure dans la paroi
      const gh = lidT + 2 * p.jeu;
      const rim = 1.6;
      const H = p.hauteur + f + gh + rim;
      const zg = p.hauteur + f;
      box.push(obj('boite', 'Boîte', 'sketch', { loops: [rectLoop(L + 2 * w, W + 2 * w, r)], op: 'extrude', height: H }));
      box.push(obj('interieur', 'Intérieur', 'sketch', { loops: [rectLoop(L, W, rin)], op: 'extrude', height: H }, { position: [0, 0, f] }, 'hole'));
      // la rainure traverse la paroi d'extrémité (+X) pour laisser entrer le couvercle
      box.push(obj('rainure', 'Rainure', 'box', { size: [L + w + 2, W + 2 * g, gh] }, { position: [(w + 2) / 2, 0, zg] }, 'hole'));
      lid.push(
        obj('couvercle', 'Couvercle coulissant', 'box', { size: [L + w - p.jeu, W + 2 * g - 2 * p.jeu, lidT] }, { position: [lidX, 0, 0] }),
      );
      lid.push(obj('glissiere', 'Prise du doigt', 'cylinder', { radius: 6, height: 1, segments: 48 }, { position: [lidX + L / 2 - 8, 0, lidT - 0.6] }, 'hole'));
    }
    return templateScene('boite', 'Boîte à couvercle', printer, [
      { id: 'boite', name: 'Boîte', objects: box },
      { id: 'couvercle', name: 'Couvercle', objects: lid },
    ], p);
  },
};
