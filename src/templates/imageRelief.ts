/** Modèle « Image en relief » : logo (seuil puis extrusion), photo en relief ou lithophane. */
import { z } from 'zod';
import { rectLoop } from './shapes';
import { SAMPLE_IMAGE, SAMPLE_RATIO } from './sampleImage';
import { obj, snapToLayer, templateScene, type TemplateDef } from './types';

export const schema = z.object({
  image: z.string().default(SAMPLE_IMAGE),
  /** Hauteur / largeur de l'image (renseigné à l'import) */
  ratio: z.number().min(0.05).max(20).default(SAMPLE_RATIO),
  style: z.enum(['logo', 'photo', 'lithophane']).default('logo'),
  largeur: z.number().min(10).max(250).default(80),
  seuil: z.number().min(1).max(254).default(128),
  inverser: z.boolean().default(false),
  relief: z.number().min(0.4).max(10).default(2),
  epaisseurMin: z.number().min(0.4).max(10).default(0.8),
  epaisseurMax: z.number().min(0.8).max(20).default(3),
  plaque: z.boolean().default(true),
  epaisseurPlaque: z.number().min(0.8).max(10).default(2),
  marge: z.number().min(0).max(30).default(4),
  arrondi: z.number().min(0).max(30).default(3),
});
export type ImageReliefParams = z.output<typeof schema>;
export const defaults: ImageReliefParams = schema.parse({});

export const imageRelief: TemplateDef<ImageReliefParams> = {
  id: 'image-relief',
  name: 'Image en relief',
  defaults,
  schema,
  sections: [
    { id: 'image', label: 'Image', objects: ['image'] },
    { id: 'plaque', label: 'Plaque de fond', objects: ['plaque'] },
  ],
  fields: [
    { key: 'image', label: 'Image (logo ou photo)', type: 'image', section: 'image' },
    {
      key: 'style',
      label: 'Style',
      type: 'select',
      section: 'image',
      options: [
        { value: 'logo', label: 'Logo (contours nets)' },
        { value: 'photo', label: 'Photo en relief' },
        { value: 'lithophane', label: 'Lithophane (à voir en transparence)' },
      ],
    },
    { key: 'largeur', label: 'Largeur', type: 'number', section: 'image', min: 10, max: 250, unit: 'mm' },
    { key: 'seuil', label: 'Seuil (clair / foncé)', type: 'slider', section: 'image', min: 1, max: 254, step: 1, showIf: (p) => p.style === 'logo' },
    { key: 'inverser', label: 'Inverser clair / foncé', type: 'toggle', section: 'image' },
    { key: 'relief', label: 'Relief', type: 'slider', section: 'image', min: 0.4, max: 6, step: 0.1, unit: 'mm', showIf: (p) => p.style === 'logo' },
    { key: 'epaisseurMin', label: 'Épaisseur min.', type: 'slider', section: 'image', min: 0.4, max: 5, step: 0.1, unit: 'mm', showIf: (p) => p.style !== 'logo' },
    { key: 'epaisseurMax', label: 'Épaisseur max.', type: 'slider', section: 'image', min: 0.8, max: 10, step: 0.1, unit: 'mm', showIf: (p) => p.style !== 'logo' },
    { key: 'plaque', label: 'Plaque de fond', type: 'toggle', section: 'plaque', showIf: (p) => p.style === 'logo' },
    { key: 'epaisseurPlaque', label: 'Épaisseur de la plaque', type: 'slider', section: 'plaque', min: 0.8, max: 8, step: 0.2, unit: 'mm', showIf: (p) => p.style === 'logo' && p.plaque },
    { key: 'marge', label: 'Marge autour de l’image', type: 'slider', section: 'plaque', min: 0, max: 20, step: 0.5, unit: 'mm', showIf: (p) => p.style === 'logo' && p.plaque },
    { key: 'arrondi', label: 'Coins arrondis', type: 'slider', section: 'plaque', min: 0, max: 20, step: 0.5, unit: 'mm', showIf: (p) => p.style === 'logo' && p.plaque },
  ],
  build(p, printer) {
    const objects: Record<string, unknown>[] = [];
    let colorChanges: number[] | undefined;
    if (p.style === 'logo') {
      const base = p.plaque ? snapToLayer(p.epaisseurPlaque) : 0;
      if (p.plaque) {
        objects.push(obj('plaque', 'Plaque', 'sketch', { loops: [rectLoop(p.largeur + 2 * p.marge, p.largeur * p.ratio + 2 * p.marge, p.arrondi)], op: 'extrude', height: base }));
        colorChanges = [base];
      }
      objects.push(
        obj('image', 'Logo', 'image', { src: p.image, width: p.largeur, mode: 'threshold', threshold: p.seuil, invert: p.inverser, maxHeight: p.relief + (p.plaque ? 0.5 : 0) }, { position: [0, 0, p.plaque ? base - 0.5 : 0] }),
      );
    } else {
      const litho = p.style === 'lithophane';
      objects.push(
        obj('image', litho ? 'Lithophane' : 'Photo en relief', 'image', {
          src: p.image,
          width: p.largeur,
          mode: 'heightmap',
          invert: litho ? p.inverser : !p.inverser,
          minHeight: p.epaisseurMin,
          maxHeight: Math.max(p.epaisseurMin + 0.2, p.epaisseurMax),
        }),
      );
    }
    return templateScene('image-relief', 'Image en relief', printer, [{ id: 'image', name: 'Image', objects, colorChanges }], p);
  },
};
