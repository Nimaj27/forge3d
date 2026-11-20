import type { Vec3 } from '../../shared/scene';

/** Profil d'imprimante : volume d'impression en millimètres (X × Y × Z). */
export interface PrinterProfile {
  id: string;
  name: string;
  /** Nom court affiché sur téléphone */
  shortName: string;
  bed: Vec3;
}

export const CUSTOM_PRINTER_ID = 'custom';

export const PRINTERS: PrinterProfile[] = [
  { id: 'ff-5m-pro', name: 'Flashforge Adventurer 5M Pro', shortName: '5M Pro', bed: [220, 220, 220] },
  { id: 'bambu-a1', name: 'Bambu Lab A1', shortName: 'A1', bed: [256, 256, 256] },
  { id: 'bambu-a1-mini', name: 'Bambu Lab A1 mini', shortName: 'A1 mini', bed: [180, 180, 180] },
  { id: 'prusa-mk4', name: 'Prusa MK4', shortName: 'MK4', bed: [250, 210, 220] },
];

export const DEFAULT_PRINTER_ID = 'ff-5m-pro';

/** Retrouve un profil ; « Personnalisée » utilise le volume saisi par l'utilisateur. */
export function resolvePrinter(id: string, customBed: Vec3): PrinterProfile {
  if (id === CUSTOM_PRINTER_ID) {
    return { id: CUSTOM_PRINTER_ID, name: 'Personnalisée', shortName: 'Perso', bed: customBed };
  }
  return PRINTERS.find((p) => p.id === id) ?? PRINTERS[0];
}
