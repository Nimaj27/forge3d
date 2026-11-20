/** Modèle « Plaque gravée » : texte 1 à 3 lignes, logo, cadre, trous de fixation (fraisés). */
import { z } from 'zod';
import { FONT_IDS } from '../../shared/scene';
import { rectLoop } from './shapes';
import { obj, snapToLayer, templateScene, type TemplateDef } from './types';

export const schema = z.object({
  largeur: z.number().min(30).max(250).default(150),
  hauteur: z.number().min(15).max(250).default(60),
  epaisseur: z.number().min(1.6).max(12).default(4),
  arrondi: z.number().min(0).max(40).default(6),
  texte: z.string().max(120).default('Caserne de Pacy'),
  police: z.enum(FONT_IDS).default('classique'),
  hauteurLettres: z.number().min(3).max(60).default(10),
  relief: z.number().min(0.4).max(5).default(1.2),
  cadre: z.boolean().default(true),
  largeurCadre: z.number().min(0.8).max(10).default(2),
  trous: z.enum(['aucun', '2', '4']).default('2'),
  diametreTrou: z.number().min(2).max(12).default(4.5),
  fraisage: z.boolean().default(true),
  logo: z.string().default(''),
  largeurLogo: z.number().min(5).max(120).default(22),
  bicolore: z.boolean().default(true),
});
export type PlaqueParams = z.output<typeof schema>;
export const defaults: PlaqueParams = schema.parse({});

export const plaque: TemplateDef<PlaqueParams> = {
  id: 'plaque',
  name: 'Plaque gravée',
  defaults,
  schema,
  sections: [
    { id: 'plaque', label: 'Plaque', objects: ['plaque', 'cadre', 'trou'] },
    { id: 'texte', label: 'Texte', objects: ['texte'] },
    { id: 'logo', label: 'Logo', objects: ['logo'] },
  ],
  fields: [
    { key: 'largeur', label: 'Largeur', type: 'number', section: 'plaque', min: 30, max: 250, unit: 'mm' },
    { key: 'hauteur', label: 'Hauteur', type: 'number', section: 'plaque', min: 15, max: 250, unit: 'mm' },
    { key: 'epaisseur', label: 'Épaisseur', type: 'number', section: 'plaque', min: 1.6, max: 12, step: 0.2, unit: 'mm' },
    { key: 'arrondi', label: 'Coins arrondis', type: 'slider', section: 'plaque', min: 0, max: 30, step: 0.5, unit: 'mm' },
    { key: 'cadre', label: 'Cadre en relief', type: 'toggle', section: 'plaque' },
    { key: 'largeurCadre', label: 'Largeur du cadre', type: 'slider', section: 'plaque', min: 0.8, max: 8, step: 0.2, unit: 'mm', showIf: (p) => p.cadre },
    {
      key: 'trous',
      label: 'Trous de fixation',
      type: 'select',
      section: 'plaque',
      options: [
        { value: 'aucun', label: 'Aucun' },
        { value: '2', label: '2 trous' },
        { value: '4', label: '4 trous (coins)' },
      ],
    },
    { key: 'diametreTrou', label: 'Ø des trous', type: 'number', section: 'plaque', min: 2, max: 12, step: 0.1, unit: 'mm', showIf: (p) => p.trous !== 'aucun' },
    { key: 'fraisage', label: 'Fraisage (vis à tête fraisée)', type: 'toggle', section: 'plaque', showIf: (p) => p.trous !== 'aucun' },
    { key: 'texte', label: 'Texte (1 à 3 lignes)', type: 'textarea', section: 'texte' },
    { key: 'police', label: 'Police', type: 'font', section: 'texte' },
    { key: 'hauteurLettres', label: 'Hauteur des lettres', type: 'slider', section: 'texte', min: 3, max: 40, step: 0.1, unit: 'mm' },
    { key: 'relief', label: 'Relief', type: 'slider', section: 'texte', min: 0.4, max: 4, step: 0.1, unit: 'mm' },
    { key: 'bicolore', label: 'Bicolore (pause au-dessus de la plaque)', type: 'toggle', section: 'texte' },
    { key: 'logo', label: 'Logo (image)', type: 'image', section: 'logo' },
    { key: 'largeurLogo', label: 'Largeur du logo', type: 'slider', section: 'logo', min: 5, max: 100, step: 1, unit: 'mm', showIf: (p) => !!p.logo },
  ],
  build(p, printer) {
    const ep = snapToLayer(p.epaisseur);
    const top = ep - 0.5; // reliefs encastrés de 0,5 mm
    const objects: Record<string, unknown>[] = [
      obj('plaque', 'Plaque', 'sketch', { loops: [rectLoop(p.largeur, p.hauteur, p.arrondi)], op: 'extrude', height: ep }),
    ];
    const margin = 3;
    if (p.cadre) {
      const w = p.largeur - 2 * margin;
      const h = p.hauteur - 2 * margin;
      const r = Math.max(0, p.arrondi - margin);
      const c = p.largeurCadre;
      objects.push(
        obj('cadre', 'Cadre', 'sketch', { loops: [rectLoop(w, h, r), rectLoop(w - 2 * c, h - 2 * c, Math.max(0, r - c))], op: 'extrude', height: p.relief + 0.5 }, { position: [0, 0, top] }),
      );
    }
    const logoW = p.logo ? p.largeurLogo : 0;
    const shift = p.logo ? (logoW + 6) / 2 : 0;
    if (p.texte.trim()) {
      objects.push(
        obj('texte', 'Texte', 'text', { text: p.texte, font: p.police, capHeight: p.hauteurLettres, depth: p.relief + 0.5, lineSpacing: 1.45 }, { position: [shift, 0, top] }),
      );
    }
    if (p.logo) {
      objects.push(obj('logo', 'Logo', 'image', { src: p.logo, width: logoW, mode: 'threshold', maxHeight: p.relief + 0.5 }, { position: [-p.largeur / 2 + logoW / 2 + 10, 0, top] }));
    }
    if (p.trous !== 'aucun') {
      const dx = p.largeur / 2 - (margin + (p.cadre ? p.largeurCadre : 0) + p.diametreTrou / 2 + 2);
      const dy = p.hauteur / 2 - (margin + (p.cadre ? p.largeurCadre : 0) + p.diametreTrou / 2 + 2);
      const pts: [number, number][] = p.trous === '2' ? [[-dx, 0], [dx, 0]] : [[-dx, -dy], [dx, -dy], [-dx, dy], [dx, dy]];
      pts.forEach(([x, y], i) => {
        objects.push(obj(`trou-${i + 1}`, `Trou ${i + 1}`, 'cylinder', { radius: p.diametreTrou / 2, height: ep + 2, segments: 48 }, { position: [x, y, -1] }, 'hole'));
        if (p.fraisage) {
          const h = p.diametreTrou / 2 + 0.5;
          objects.push(
            obj(`fraisage-${i + 1}`, `Fraisage ${i + 1}`, 'cone', { radiusBottom: p.diametreTrou / 2, radiusTop: p.diametreTrou + 0.5, height: h, segments: 48 }, { position: [x, y, ep - h + 0.5] }, 'hole'),
          );
        }
      });
    }
    return templateScene('plaque', 'Plaque gravée', printer, [{ id: 'plaque', name: 'Plaque', objects, colorChanges: p.bicolore ? [ep] : undefined }], p);
  },
};
