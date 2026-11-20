/** Modèle « Support de téléphone » : largeur, angle, épaisseur de l'appareil, passe-câble. */
import { z } from 'zod';
import { obj, templateScene, type TemplateDef } from './types';

export const schema = z.object({
  largeur: z.number().min(40).max(200).default(80),
  angle: z.number().min(50).max(85).default(68),
  epaisseurAppareil: z.number().min(6).max(30).default(12),
  profondeur: z.number().min(50).max(150).default(70),
  hauteurDossier: z.number().min(40).max(160).default(78),
  passeCable: z.boolean().default(true),
  largeurCable: z.number().min(6).max(25).default(14),
});
export type SupportParams = z.output<typeof schema>;
export const defaults: SupportParams = schema.parse({});

export const supportTelephone: TemplateDef<SupportParams> = {
  id: 'support-telephone',
  name: 'Support de téléphone',
  defaults,
  schema,
  sections: [
    { id: 'support', label: 'Support', objects: ['socle', 'dossier', 'rebord'] },
    { id: 'cable', label: 'Passe-câble', objects: ['passe-cable'] },
  ],
  fields: [
    { key: 'largeur', label: 'Largeur', type: 'number', section: 'support', min: 40, max: 200, unit: 'mm' },
    { key: 'angle', label: 'Angle du dossier', type: 'slider', section: 'support', min: 50, max: 85, step: 1, unit: '°', help: 'Mesuré depuis la table (90° = vertical).' },
    { key: 'epaisseurAppareil', label: 'Épaisseur du téléphone (avec coque)', type: 'slider', section: 'support', min: 6, max: 30, step: 0.5, unit: 'mm' },
    { key: 'profondeur', label: 'Profondeur du socle', type: 'number', section: 'support', min: 50, max: 150, unit: 'mm' },
    { key: 'hauteurDossier', label: 'Hauteur du dossier', type: 'number', section: 'support', min: 40, max: 160, unit: 'mm' },
    { key: 'passeCable', label: 'Passe-câble dans le rebord', type: 'toggle', section: 'cable' },
    { key: 'largeurCable', label: 'Largeur du passage', type: 'slider', section: 'cable', min: 6, max: 25, step: 0.5, unit: 'mm', showIf: (p) => p.passeCable },
  ],
  build(p, printer) {
    const ep = 6;
    const t = 6; // épaisseur du dossier
    const tilt = -(90 - p.angle); // inclinaison vers l'arrière autour de X
    const y0 = p.profondeur / 2 - 20;
    const z0 = ep - 0.5;
    const tan = Math.tan(((90 - p.angle) * Math.PI) / 180);
    // face avant du dossier au niveau du dessus du socle
    const yFront = y0 - t / 2 / Math.cos(((90 - p.angle) * Math.PI) / 180) + 0.5 * tan;
    const lipD = 8;
    const yLip = yFront - p.epaisseurAppareil - lipD / 2;
    const objects: Record<string, unknown>[] = [
      obj('socle', 'Socle', 'box', { size: [p.largeur, p.profondeur, ep], edgeRadius: 0 }),
      obj('dossier', 'Dossier', 'box', { size: [p.largeur, t, p.hauteurDossier] }, { position: [0, y0, z0], rotation: [tilt, 0, 0] }),
      obj('rebord', 'Rebord', 'box', { size: [p.largeur, lipD, 12] }, { position: [0, yLip, z0] }),
    ];
    if (p.passeCable) {
      objects.push(obj('passe-cable', 'Passe-câble', 'box', { size: [p.largeurCable, lipD + 2, 13] }, { position: [0, yLip, ep - 0.6] }, 'hole'));
    }
    return templateScene('support-telephone', 'Support de téléphone', printer, [{ id: 'support', name: 'Support', objects }], p);
  },
};
