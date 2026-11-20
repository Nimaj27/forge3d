import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Vec3 } from '../../shared/scene';
import { CUSTOM_PRINTER_ID, DEFAULT_PRINTER_ID, PRINTERS, resolvePrinter, type PrinterProfile } from '../lib/printers';

/** Couleurs d'accent proposées (brief §8). */
export const ACCENTS = ['#F59E3D', '#E8C547', '#5EA8F5', '#5BC88A'] as const;

/** Couleurs par défaut des filaments pour l'aperçu bicolore. */
export const DEFAULT_FILAMENTS = ['#9A9DA2', '#D6A838'] as const;

interface SettingsState {
  printerId: string;
  customBed: Vec3;
  accent: string;
  /** Couleurs de filament utilisées pour l'aperçu par couches */
  filaments: string[];
  setPrinter: (id: string) => void;
  setCustomBed: (bed: Vec3) => void;
  setAccent: (accent: string) => void;
  setFilament: (index: number, color: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      printerId: DEFAULT_PRINTER_ID,
      customBed: [220, 220, 220],
      accent: ACCENTS[0],
      filaments: [...DEFAULT_FILAMENTS],
      setPrinter: (id) =>
        set({ printerId: id === CUSTOM_PRINTER_ID || PRINTERS.some((p) => p.id === id) ? id : DEFAULT_PRINTER_ID }),
      setCustomBed: (bed) => set({ customBed: bed.map((v) => Math.min(1000, Math.max(20, v))) as Vec3 }),
      setAccent: (accent) => set({ accent }),
      setFilament: (index, color) =>
        set((s) => {
          const filaments = [...s.filaments];
          filaments[index] = color;
          return { filaments };
        }),
    }),
    { name: 'forge3d-settings', version: 1 },
  ),
);

/** Profil d'imprimante actif. */
export function usePrinter(): PrinterProfile {
  const printerId = useSettings((s) => s.printerId);
  const customBed = useSettings((s) => s.customBed);
  return resolvePrinter(printerId, customBed);
}
